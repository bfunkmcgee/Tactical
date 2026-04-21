import { useEffect, useRef } from 'react';
import { Application, Assets, Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import { useCombatStore } from '../../state/combatStore';
import { useContent } from '../../content/registry';
import type { GridMap, Unit, UnitId, Vec2 } from '../types';
import { TILE_W, TILE_H, gridToScreen, screenToGrid } from './isoProjection';
import { chebyshev, keyOf, tileAt } from '../engine/grid';
import { hasLineOfSight } from '../engine/los';

/** Texture cache keyed by unit templateId — shared across mount cycles. */
const spriteCache = new Map<string, Texture>();

/**
 * Per-unit render node. Persists across store updates so animations
 * (idle bob, selection pulse, movement tween, hit flash, fire lunge,
 * death fade) can tween continuously without being torn down each frame.
 *
 * `container` is the outer positioned transform (world-space). `body`
 * holds the sprite + shadow and handles facing-flip / bob / pulse so
 * the HP bar and labels above it stay upright.
 */
type UnitNode = {
  container: Container;
  body: Container;
  shadow: Graphics;
  sprite: Sprite | null;
  fallback: Graphics | null;
  hpBar: Graphics;
  label: Text;
  ornaments: Container;
  selectionRing: Graphics;
  spriteTop: number;

  // Movement tween — screen-space, measured in world coords (pre-camera).
  currentScreen: { x: number; y: number };
  targetScreen: { x: number; y: number };
  moveMs: number;
  moveDurationMs: number;

  // Visual state.
  facing: 1 | -1;       // body.scale.x sign; -1 flips the sprite horizontally.
  prevHp: number;
  prevAmmo: number;
  hitFlashMs: number;   // red-tint + jitter countdown (target of an attack).
  fireLungeMs: number;  // forward-lunge countdown (shooter).
  lungeDir: { x: number; y: number }; // unit vector toward the shot target.
  deathMs: number | null; // counts up to DEATH_DURATION_MS once alive=false.
  selected: boolean;
  bobPhase: number;     // randomized so squad doesn't bob in lockstep.
};

/** Preload every templateId the active pack provides a spritePath for. */
async function ensureSpritesLoaded(pack: ReturnType<typeof useContent>): Promise<void> {
  const resolve = pack.theme?.spritePath;
  if (!resolve) return;
  const ids = [...Object.keys(pack.soldierTemplates), ...Object.keys(pack.enemyTemplates)];
  await Promise.all(ids.map(async (id) => {
    if (spriteCache.has(id)) return;
    const url = resolve(id);
    if (!url) return;
    try {
      const tex = await Assets.load<Texture>(url);
      spriteCache.set(id, tex);
    } catch (err) {
      console.warn(`[sprites] failed to load ${id} from ${url}`, err);
    }
  }));
}

/** Mounts a single Pixi application and reflects store state each tick. */
export default function PixiStage() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current!;
    const app = new Application();
    let destroyed = false;

    (async () => {
      await app.init({
        resizeTo: host,
        background: '#0b0f14',
        antialias: true,
        resolution: Math.min(window.devicePixelRatio, 2),
        autoDensity: true,
      });
      if (destroyed) { app.destroy(true); return; }
      host.appendChild(app.canvas);

      const world = new Container();
      const tileLayer = new Container();
      const overlayLayer = new Container();
      const unitLayer = new Container();
      const fxLayer = new Container();
      // Z-sort units by iso depth so taller sprites occlude correctly.
      unitLayer.sortableChildren = true;
      world.addChild(tileLayer, overlayLayer, unitLayer, fxLayer);
      app.stage.addChild(world);

      // Per-unit animated nodes. Mission re-init wipes this; the mount effect
      // owns it via closure so no module-level leak survives tab changes.
      const unitNodes = new Map<UnitId, UnitNode>();

      const cam = { x: app.screen.width / 2, y: 80, zoom: 1 };
      const shakeOffset = { x: 0, y: 0 };
      const applyCam = () => {
        world.position.set(cam.x + shakeOffset.x, cam.y + shakeOffset.y);
        world.scale.set(cam.zoom);
      };

      const initialState = useCombatStore.getState();
      drawMap(tileLayer, initialState.map);
      applyCam();

      // Defer unit rendering until sprite preload settles. For packs without
      // theme.spritePath (e.g. Void-Watch), ensureSpritesLoaded resolves on
      // the next microtask, so the unit layer still populates quickly.
      let spritesReady = false;
      ensureSpritesLoaded(useContent()).then(() => {
        if (destroyed) return;
        spritesReady = true;
        syncUnits(unitLayer, unitNodes, useCombatStore.getState());
      });

      // ---- Input ----
      const pointers = new Map<number, { x: number; y: number }>();
      let panStart: { cx: number; cy: number; px: number; py: number } | null = null;
      let pinchStart: { dist: number; zoom: number } | null = null;
      let dragged = false;

      const screenToWorld = (x: number, y: number) => ({
        x: (x - cam.x) / cam.zoom,
        y: (y - cam.y) / cam.zoom,
      });

      app.canvas.style.touchAction = 'none';

      const onDown = (e: PointerEvent) => {
        app.canvas.setPointerCapture?.(e.pointerId);
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        dragged = false;
        if (pointers.size === 1) {
          panStart = { cx: cam.x, cy: cam.y, px: e.clientX, py: e.clientY };
        } else if (pointers.size === 2) {
          const pts = [...pointers.values()];
          const dx = pts[0].x - pts[1].x, dy = pts[0].y - pts[1].y;
          pinchStart = { dist: Math.hypot(dx, dy), zoom: cam.zoom };
          panStart = null;
        }
      };
      const onMove = (e: PointerEvent) => {
        if (!pointers.has(e.pointerId)) return;
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.size === 1 && panStart) {
          const dx = e.clientX - panStart.px, dy = e.clientY - panStart.py;
          if (Math.hypot(dx, dy) > 6) dragged = true;
          cam.x = panStart.cx + dx; cam.y = panStart.cy + dy;
          applyCam();
        } else if (pointers.size === 2 && pinchStart) {
          const pts = [...pointers.values()];
          const dx = pts[0].x - pts[1].x, dy = pts[0].y - pts[1].y;
          const d = Math.hypot(dx, dy);
          cam.zoom = Math.max(0.5, Math.min(2.2, pinchStart.zoom * (d / pinchStart.dist)));
          dragged = true;
          applyCam();
        }
      };
      const onUp = (e: PointerEvent) => {
        const hadTwo = pointers.size === 2;
        pointers.delete(e.pointerId);
        if (!hadTwo && !dragged) {
          const rect = app.canvas.getBoundingClientRect();
          const w = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
          onTapGrid(screenToGrid(w));
        }
        if (pointers.size < 2) pinchStart = null;
        if (pointers.size === 0) panStart = null;
      };
      app.canvas.addEventListener('pointerdown', onDown);
      app.canvas.addEventListener('pointermove', onMove);
      app.canvas.addEventListener('pointerup', onUp);
      app.canvas.addEventListener('pointercancel', onUp);
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        cam.zoom = Math.max(0.5, Math.min(2.2, cam.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
        applyCam();
      };
      app.canvas.addEventListener('wheel', onWheel, { passive: false });

      function onTapGrid(g: Vec2) {
        const st = useCombatStore.getState();
        if (!inMap(st.map, g)) return;
        const unitAt = st.units.find((u) => u.alive && u.pos.x === g.x && u.pos.y === g.y);

        // Tap cancels an open pending preview (unless the same target is re-tapped to confirm).
        if (st.pendingShotTargetId !== null) {
          if (unitAt && unitAt.id === st.pendingShotTargetId) { st.confirmPending(); return; }
          st.cancelPending();
          if (st.mode !== 'fire' && st.mode !== 'sidearm') return;
        }
        if (st.pendingUtility) {
          if (st.pendingUtility.center.x === g.x && st.pendingUtility.center.y === g.y) { st.confirmPending(); return; }
          st.cancelPending();
          if (st.mode !== 'utility') return;
        }

        if (st.mode === 'idle') {
          if (unitAt && unitAt.faction === 'player') { st.selectUnit(unitAt.id); return; }
          if (unitAt && unitAt.faction === 'enemy') {
            st.setMode('fire'); st.queueShot(unitAt.id); return;
          }
          if (st.selectedId && st.reach.has(keyOf(g.x, g.y))) st.tryMove(g);
          return;
        }
        if (st.mode === 'move') {
          if (st.reach.has(keyOf(g.x, g.y))) st.tryMove(g);
          else st.setMode('idle');
          return;
        }
        if (st.mode === 'fire') {
          if (unitAt && unitAt.faction === 'enemy') st.queueShot(unitAt.id);
          else st.setMode('idle');
          return;
        }
        if (st.mode === 'sidearm') {
          if (unitAt && unitAt.faction === 'enemy') st.queueSidearmShot(unitAt.id);
          else st.setMode('idle');
          return;
        }
        if (st.mode === 'utility' && st.selectedUtilityIdx !== null) {
          st.queueUtility(g, st.selectedUtilityIdx);
          return;
        }
      }

      // Re-render reactive layers whenever the store changes.
      // Floaters are drained to a local list so ticker animation doesn't churn
      // the store every frame.
      type ActiveFloater = { text: string; color: number; pos: Vec2; bornMs: number };
      const active: ActiveFloater[] = [];
      const FLOATER_MS = 900;

      const unsub = useCombatStore.subscribe(() => {
        const s = useCombatStore.getState();
        if (s.floaters.length > 0) {
          const now = performance.now();
          for (const f of s.floaters) active.push({ text: f.text, color: f.color, pos: f.pos, bornMs: now });
          useCombatStore.setState({ floaters: [] });
        }
        redrawOverlays(overlayLayer, s);
        if (spritesReady) syncUnits(unitLayer, unitNodes, s);
      });
      redrawOverlays(overlayLayer, initialState);
      if (spritesReady) syncUnits(unitLayer, unitNodes, initialState);

      app.ticker.add((ticker) => {
        const dtMs = ticker.deltaMS;
        const now = performance.now();
        const st = useCombatStore.getState();
        if (st.shakeFrames > 0) {
          shakeOffset.x = (Math.random() - 0.5) * 8;
          shakeOffset.y = (Math.random() - 0.5) * 8;
          useCombatStore.setState({ shakeFrames: st.shakeFrames - 1 });
          applyCam();
        } else if (shakeOffset.x !== 0 || shakeOffset.y !== 0) {
          shakeOffset.x = 0; shakeOffset.y = 0;
          applyCam();
        }
        // Advance unit animations (bob, movement tween, hit flash, death fade).
        tickUnitAnimations(unitLayer, unitNodes, dtMs, now);
        // Prune aged floaters in the local list, then render.
        for (let i = active.length - 1; i >= 0; i--) {
          if (now - active[i].bornMs > FLOATER_MS) active.splice(i, 1);
        }
        renderActiveFloaters(fxLayer, active, now, FLOATER_MS);
      });

      (app as unknown as { __cleanup?: () => void }).__cleanup = () => {
        unsub();
        app.canvas.removeEventListener('pointerdown', onDown);
        app.canvas.removeEventListener('pointermove', onMove);
        app.canvas.removeEventListener('pointerup', onUp);
        app.canvas.removeEventListener('pointercancel', onUp);
        app.canvas.removeEventListener('wheel', onWheel);
      };
    })();

    return () => {
      destroyed = true;
      (app as unknown as { __cleanup?: () => void }).__cleanup?.();
      try { app.destroy(true); } catch {}
    };
  }, []);

  return <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />;
}

function inMap(m: GridMap, g: Vec2) {
  return g.x >= 0 && g.y >= 0 && g.x < m.width && g.y < m.height;
}

function diamond(g: Graphics, cx: number, cy: number, fill: number, alpha: number, stroke?: number) {
  g.moveTo(cx, cy - TILE_H / 2);
  g.lineTo(cx + TILE_W / 2, cy);
  g.lineTo(cx, cy + TILE_H / 2);
  g.lineTo(cx - TILE_W / 2, cy);
  g.closePath();
  g.fill({ color: fill, alpha });
  if (stroke !== undefined) g.stroke({ color: stroke, width: 1, alpha: 0.5 });
}

function drawMap(layer: Container, map: GridMap) {
  layer.removeChildren();
  const g = new Graphics();
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const t = tileAt(map, x, y)!;
      const p = gridToScreen({ x, y });
      let fill = 0x1b2331;
      if (t.kind === 'floor') fill = t.variant === 0 ? 0x1b2331 : t.variant === 1 ? 0x202a3c : 0x1a2230;
      else if (t.kind === 'wall') fill = 0x0b0f14;
      else if (t.kind === 'cover_half') fill = 0x3c5673;
      else if (t.kind === 'cover_full') fill = 0x5a7498;
      diamond(g, p.x, p.y, fill, 1, 0x2a3447);
      if (t.kind === 'cover_half' || t.kind === 'cover_full') {
        const h = t.kind === 'cover_full' ? 22 : 12;
        g.rect(p.x - 14, p.y - h, 28, h).fill({ color: fill, alpha: 0.9 }).stroke({ color: 0x0b0f14, width: 1 });
      }
    }
  }
  layer.addChild(g);
}

function redrawOverlays(layer: Container, st: ReturnType<typeof useCombatStore.getState>) {
  layer.removeChildren();

  const g = new Graphics();
  const smokeSet = new Set(st.smokeTiles.keys());

  // Smoke clouds (always drawn, regardless of selection state).
  for (const [k, rounds] of st.smokeTiles) {
    const x = k % 4096, y = Math.floor(k / 4096);
    const p = gridToScreen({ x, y });
    // Fade as the cloud nears dissipation.
    const alpha = rounds >= 2 ? 0.6 : 0.4;
    diamond(g, p.x, p.y, 0xc8c8d0, alpha, 0xa0a0b0);
  }

  const sel = st.units.find((u) => u.id === st.selectedId);
  if (!sel || sel.faction !== 'player' || !sel.alive) {
    layer.addChild(g);
    return;
  }

  // Movement reach when not targeting.
  if ((st.mode === 'move' || st.mode === 'idle') && st.pendingUtility === null && st.pendingShotTargetId === null) {
    for (const [k, d] of st.reach) {
      const x = k % 4096, y = Math.floor(k / 4096);
      if (x === sel.pos.x && y === sel.pos.y) continue;
      const p = gridToScreen({ x, y });
      const apCost = Math.ceil(d / sel.mobility);
      const color = apCost <= 1 ? 0x7cc4ff : 0xf5c55a;
      diamond(g, p.x, p.y, color, 0.18, color);
    }
  }

  // Fire / Sidearm mode: mark valid targets in LOS (smoke blocks).
  if (st.mode === 'fire' || st.mode === 'sidearm') {
    for (const enemy of st.units) {
      if (enemy.faction !== 'enemy' || !enemy.alive) continue;
      if (!hasLineOfSight(st.map, sel.pos, enemy.pos, smokeSet)) continue;
      const p = gridToScreen(enemy.pos);
      const pending = st.pendingShotTargetId === enemy.id;
      diamond(g, p.x, p.y, 0xff5a6a, pending ? 0.45 : 0.28, 0xff5a6a);
    }
  }

  // Utility mode: shade tiles within throw range; highlight AoE if a target is pending.
  if (st.mode === 'utility' && st.selectedUtilityIdx !== null && sel.loadout) {
    const util = useContent().utilities[sel.loadout.utilityIds[st.selectedUtilityIdx]];
    if (util) {
      for (let y = 0; y < st.map.height; y++) {
        for (let x = 0; x < st.map.width; x++) {
          if (chebyshev(sel.pos, { x, y }) > util.range) continue;
          const p = gridToScreen({ x, y });
          diamond(g, p.x, p.y, 0xff9a3c, 0.08);
        }
      }
      if (st.pendingUtility) {
        const c = st.pendingUtility.center;
        for (let y = 0; y < st.map.height; y++) {
          for (let x = 0; x < st.map.width; x++) {
            if (chebyshev(c, { x, y }) > util.radius) continue;
            const p = gridToScreen({ x, y });
            diamond(g, p.x, p.y, 0xff9a3c, 0.35, 0xff9a3c);
          }
        }
      }
    }
  }

  layer.addChild(g);
}

/** Durations (ms) for movement / hit / fire / death animations. */
const MOVE_TWEEN_MS = 220;
const HIT_FLASH_MS = 240;
const FIRE_LUNGE_MS = 180;
const DEATH_DURATION_MS = 520;

/**
 * Reconcile `unitNodes` against the store's unit list:
 *  - Create a persistent node for any new unit.
 *  - Update per-unit visual state (HP bar text, ornaments, facing, animation triggers).
 *  - Start movement tween when grid position changes.
 *  - Trigger hit flash when HP drops, death fade when alive→false, fire lunge when ammo drops.
 *
 * The ticker drives the actual frame-by-frame interpolation.
 */
function syncUnits(
  layer: Container,
  nodes: Map<UnitId, UnitNode>,
  st: ReturnType<typeof useCombatStore.getState>
) {
  const seen = new Set<UnitId>();
  for (const u of st.units) {
    seen.add(u.id);
    let node = nodes.get(u.id);
    if (!node) {
      node = createUnitNode(u);
      layer.addChild(node.container);
      nodes.set(u.id, node);
    }
    updateUnitNode(node, u, u.id === st.selectedId, st.units);
  }
  // Units dropped by initMission — destroy their nodes outright.
  for (const [id, node] of nodes) {
    if (seen.has(id)) continue;
    layer.removeChild(node.container);
    node.container.destroy({ children: true });
    nodes.delete(id);
  }
}

function createUnitNode(u: Unit): UnitNode {
  const container = new Container();
  const body = new Container();
  const shadow = new Graphics();
  shadow.ellipse(0, 6, 14, 6).fill({ color: 0x000000, alpha: 0.45 });
  body.addChild(shadow);

  let sprite: Sprite | null = null;
  let fallback: Graphics | null = null;
  let spriteTop: number;
  const tex = spriteCache.get(u.templateId);
  if (tex) {
    sprite = new Sprite(tex);
    sprite.anchor.set(0.5, 1);
    sprite.scale.set(0.42);
    sprite.position.set(0, 4);
    body.addChild(sprite);
    spriteTop = -50;
  } else {
    fallback = new Graphics();
    const color = parseInt(u.color.slice(1), 16);
    fallback.roundRect(-10, -30, 20, 30, 4).fill(color).stroke({ color: 0x0b0f14, width: 1 });
    fallback.circle(0, -36, 8).fill(color).stroke({ color: 0x0b0f14, width: 1 });
    body.addChild(fallback);
    spriteTop = -44;
  }

  const selectionRing = new Graphics();
  const hpBar = new Graphics();
  const label = new Text({
    text: '',
    style: { fill: 0xaab4c4, fontSize: 10, fontFamily: 'system-ui' },
  });
  label.anchor.set(0.5, 1);
  const ornaments = new Container();

  // Order: ring on the ground, then body, then top-of-head ornaments/bar/label.
  container.addChild(selectionRing, body, ornaments, hpBar, label);

  const p = gridToScreen(u.pos);
  container.position.set(p.x, p.y);

  return {
    container, body, shadow, sprite, fallback, hpBar, label, ornaments, selectionRing,
    spriteTop,
    currentScreen: { x: p.x, y: p.y },
    targetScreen: { x: p.x, y: p.y },
    moveMs: 0, moveDurationMs: 0,
    facing: 1,
    prevHp: u.hp,
    prevAmmo: u.ammo + u.sidearmAmmo,
    hitFlashMs: 0,
    fireLungeMs: 0,
    lungeDir: { x: 0, y: 0 },
    deathMs: u.alive ? null : 0,
    selected: false,
    bobPhase: Math.random() * Math.PI * 2,
  };
}

function updateUnitNode(node: UnitNode, u: Unit, selected: boolean, all: Unit[]) {
  // ---- Movement: grid position changed → tween from wherever we're rendered now.
  const target = gridToScreen(u.pos);
  if (target.x !== node.targetScreen.x || target.y !== node.targetScreen.y) {
    node.currentScreen = { x: node.container.position.x, y: node.container.position.y };
    node.targetScreen = { x: target.x, y: target.y };
    node.moveMs = 0;
    node.moveDurationMs = MOVE_TWEEN_MS;
    const dx = target.x - node.currentScreen.x;
    if (Math.abs(dx) > 0.5) node.facing = dx > 0 ? 1 : -1;
  }

  // ---- Hit: HP dropped this sync → flash red + jitter.
  if (u.hp < node.prevHp && u.alive) node.hitFlashMs = HIT_FLASH_MS;
  node.prevHp = u.hp;

  // ---- Fire: total rounds dropped → lunge toward nearest opposing live unit.
  const ammoNow = u.ammo + u.sidearmAmmo;
  if (ammoNow < node.prevAmmo && u.alive) {
    const opp = nearestOpposingLiveUnit(u, all);
    if (opp) {
      const tp = gridToScreen(opp.pos);
      const dx = tp.x - target.x, dy = tp.y - target.y;
      const len = Math.hypot(dx, dy) || 1;
      node.lungeDir = { x: dx / len, y: dy / len };
      node.fireLungeMs = FIRE_LUNGE_MS;
      if (Math.abs(dx) > 0.5) node.facing = dx > 0 ? 1 : -1;
    }
  }
  node.prevAmmo = ammoNow;

  // ---- Death: transition to dying once, then let the ticker animate the fade.
  if (!u.alive && node.deathMs === null) node.deathMs = 0;

  // ---- HP bar.
  const pct = Math.max(0, u.hp) / u.hpMax;
  const barY = node.spriteTop - 12;
  node.hpBar.clear();
  if (u.alive) {
    node.hpBar.rect(-14, barY, 28, 4).fill(0x0b0f14);
    node.hpBar.rect(-14, barY, 28 * pct, 4).fill(u.faction === 'player' ? 0x57d18b : 0xff5a6a);
  }

  // ---- Label.
  node.label.text = u.faction === 'player' ? `${u.name} ${u.ap}/${u.apMax}` : u.name;
  node.label.position.set(0, barY - 4);
  node.label.visible = u.alive;

  // ---- Ornaments (overwatch, blinded).
  node.ornaments.removeChildren();
  if (u.alive && u.status.overwatch) {
    const ow = new Graphics();
    ow.circle(0, node.spriteTop - 10, 4).fill(0xf5c55a);
    node.ornaments.addChild(ow);
  }
  if (u.alive && u.status.blinded) {
    const bl = new Graphics();
    bl.circle(-6, node.spriteTop - 10, 3).fill(0xc79aff);
    bl.circle(6, node.spriteTop - 10, 3).fill(0xc79aff);
    node.ornaments.addChild(bl);
  }

  // ---- Selection ring.
  node.selectionRing.clear();
  if (selected && u.alive) {
    node.selectionRing.ellipse(0, 6, 18, 8).stroke({ color: 0x7cc4ff, width: 2 });
  }
  node.selected = selected;

  // ---- Iso depth sort.
  node.container.zIndex = u.pos.x + u.pos.y;
}

function nearestOpposingLiveUnit(self: Unit, all: Unit[]): Unit | null {
  let best: Unit | null = null;
  let bestD = Infinity;
  for (const u of all) {
    if (u.faction === self.faction) continue;
    if (!u.alive) continue;
    const d = chebyshev(self.pos, u.pos);
    if (d < bestD) { bestD = d; best = u; }
  }
  return best;
}

/**
 * Per-frame animation update. Reads each node's pending timers and interpolates:
 *  - idle bob (live, not mid-move)
 *  - selected pulse (live, selected)
 *  - movement lerp (easeOutQuad)
 *  - hit flash (red tint + jitter)
 *  - fire lunge (offset toward target, returns to rest)
 *  - death fade (alpha + drop + final hide)
 */
function tickUnitAnimations(
  layer: Container,
  nodes: Map<UnitId, UnitNode>,
  dtMs: number,
  nowMs: number
) {
  for (const node of nodes.values()) {
    // Movement interpolation.
    if (node.moveDurationMs > 0) {
      node.moveMs += dtMs;
      const raw = Math.min(1, node.moveMs / node.moveDurationMs);
      const t = easeOutQuad(raw);
      const sx = node.currentScreen.x + (node.targetScreen.x - node.currentScreen.x) * t;
      const sy = node.currentScreen.y + (node.targetScreen.y - node.currentScreen.y) * t;
      node.container.position.set(sx, sy);
      if (raw >= 1) {
        node.currentScreen = { x: node.targetScreen.x, y: node.targetScreen.y };
        node.moveDurationMs = 0;
        node.moveMs = 0;
      }
    }

    const alive = node.deathMs === null;
    const moving = node.moveDurationMs > 0;

    // Idle bob — only when alive and not walking. Amplitude bumps when selected.
    const bobAmp = !alive ? 0 : moving ? 0 : node.selected ? 2.2 : 1.4;
    const bobY = bobAmp === 0 ? 0 : Math.sin(nowMs * 0.003 + node.bobPhase) * bobAmp;

    // Selected pulse on the body transform (small breathing scale).
    const pulse = alive && node.selected ? 1 + Math.sin(nowMs * 0.006) * 0.03 : 1;

    // Base body scale honours facing-flip (sprite is authored facing right).
    node.body.scale.set(node.facing * pulse, pulse);

    // Hit flash: horizontal jitter + red tint that fades with remaining time.
    let jitterX = 0;
    if (node.hitFlashMs > 0) {
      node.hitFlashMs = Math.max(0, node.hitFlashMs - dtMs);
      const a = node.hitFlashMs / HIT_FLASH_MS;
      jitterX = (Math.random() - 0.5) * 3 * a;
      applyTint(node, blendRed(a));
    } else {
      applyTint(node, 0xffffff);
    }

    // Fire lunge: brief forward shove (2px) then return.
    let lungeX = 0, lungeY = 0;
    if (node.fireLungeMs > 0) {
      node.fireLungeMs = Math.max(0, node.fireLungeMs - dtMs);
      const raw = 1 - node.fireLungeMs / FIRE_LUNGE_MS;
      // Arc 0→1→0 so the sprite lunges then returns.
      const arc = Math.sin(raw * Math.PI);
      lungeX = node.lungeDir.x * 4 * arc;
      lungeY = node.lungeDir.y * 4 * arc;
    }

    node.body.position.x = jitterX + lungeX;
    node.body.position.y = bobY + lungeY;

    // Death fade. Once complete, hide the container but leave the node for
    // reconciliation — initMission will prune it via the sync pass.
    if (node.deathMs !== null) {
      node.deathMs += dtMs;
      const t = Math.min(1, node.deathMs / DEATH_DURATION_MS);
      node.container.alpha = 1 - t;
      node.body.position.y = bobY + t * 14; // slump to the ground
      node.shadow.alpha = 1 - t * 0.8;
      node.hpBar.visible = false;
      node.label.visible = false;
      if (t >= 1) node.container.visible = false;
    } else {
      node.container.alpha = 1;
      node.container.visible = true;
      node.shadow.alpha = 1;
    }
  }
  // zIndex changes above won't take effect unless Pixi sorts; trigger it.
  layer.sortChildren();
}

function applyTint(node: UnitNode, tint: number) {
  if (node.sprite) node.sprite.tint = tint;
  if (node.fallback) node.fallback.tint = tint;
}

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

/**
 * Blend white → damage-red by `alpha` (0..1). Used for the hit flash.
 * At alpha=1 returns ~#ff5a6a (matches the enemy HP bar colour).
 */
function blendRed(alpha: number): number {
  const r = 255;
  const g = Math.round(255 - 165 * alpha);
  const b = Math.round(255 - 149 * alpha);
  return (r << 16) | (g << 8) | b;
}

function renderActiveFloaters(
  layer: Container,
  active: Array<{ text: string; color: number; pos: Vec2; bornMs: number }>,
  now: number,
  totalMs: number
) {
  layer.removeChildren();
  for (const f of active) {
    const progress = Math.min(1, (now - f.bornMs) / totalMs);
    const p = gridToScreen(f.pos);
    const t = new Text({
      text: f.text,
      style: { fill: f.color, fontSize: 16, fontWeight: 'bold', fontFamily: 'system-ui' },
    });
    t.anchor.set(0.5, 1);
    t.position.set(p.x, p.y - 56 - progress * 36);
    t.alpha = Math.max(0, 1 - progress * 1.1);
    layer.addChild(t);
  }
}

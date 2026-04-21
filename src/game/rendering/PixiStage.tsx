import { useEffect, useRef } from 'react';
import { Application, Assets, Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import { useCombatStore, type FireEvent } from '../../state/combatStore';
import { useContent } from '../../content/registry';
import type { GridMap, TileKind, Unit, UnitId, Vec2, WeaponClass } from '../types';
import { TILE_W, TILE_H, gridToScreen, screenToGrid } from './isoProjection';
import { chebyshev, keyOf, tileAt } from '../engine/grid';
import { hasLineOfSight } from '../engine/los';

/** Texture cache keyed by `${templateId}:body` or `${templateId}:weapon`. */
const spriteCache = new Map<string, Texture>();

/**
 * Per-unit render node. Persists across store updates so animations
 * (walk cycle, selection pulse, fire sequence, hit flash, death fade)
 * can tween continuously without being torn down each frame.
 *
 * Layer order inside `container`:
 *   shadow (flat) → selectionRing (flat) → body (rotates/scales) → muzzleFlash
 *   → ornaments → hpBar → label
 *
 * `body` holds the sprite and gets all rotation / scale / facing-flip. The
 * shadow and UI chrome stay on the container so they don't lean when the
 * character does.
 */
type UnitNode = {
  container: Container;
  shadow: Graphics;
  body: Container;
  sprite: Sprite | null;
  fallback: Graphics | null;
  /**
   * Weapon wrap: Container holding the weapon sprite + muzzle flash. Rotates
   * around the character's grip point so the weapon "raises" / "recoils"
   * independently of the body sway.
   */
  weaponWrap: Container | null;
  weaponSprite: Sprite | null;
  /**
   * Arms sprite. When present it lives inside the weapon wrap so the
   * arms rotate + translate with the gun, independent of the torso.
   */
  armsSprite: Sprite | null;
  /** Y position of the weapon wrap at rest (low-ready). Fire animations
   * lift from this value toward eye level and return to it. */
  weaponRestY: number;
  muzzleFlash: Graphics;
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
  facing: 1 | -1;
  prevHp: number;
  hitFlashMs: number;
  fireAnimMs: number;                   // countdown for fire sequence.
  fireStyle: FireStyle;                 // per-weapon-class choreography.
  fireTargetDir: { x: number; y: number }; // unit vector toward the shot target.
  deathMs: number | null;
  selected: boolean;
  bobPhase: number;
};

/**
 * Preload body + weapon textures for every templateId the pack provides
 * a resolver for. Cache keys are `${templateId}:body` and `:weapon`.
 * Missing / failing URLs are non-fatal — the renderer falls back to a
 * body-only sprite (or the placeholder rectangle) when a weapon is absent.
 */
async function ensureSpritesLoaded(pack: ReturnType<typeof useContent>): Promise<void> {
  const bodyResolve = pack.theme?.spritePath;
  const armsResolve = pack.theme?.armsPath;
  const weaponResolve = pack.theme?.weaponPath;
  if (!bodyResolve && !weaponResolve && !armsResolve) return;
  const ids = [...Object.keys(pack.soldierTemplates), ...Object.keys(pack.enemyTemplates)];
  const loads: Array<Promise<void>> = [];
  const pushLoad = (key: string, url: string | undefined) => {
    if (!url || spriteCache.has(key)) return;
    loads.push((async () => {
      try {
        const tex = await Assets.load<Texture>(url);
        spriteCache.set(key, tex);
      } catch (err) {
        console.warn(`[sprites] failed to load ${key} from ${url}`, err);
      }
    })());
  };
  for (const id of ids) {
    pushLoad(`${id}:body`, bodyResolve?.(id));
    pushLoad(`${id}:arms`, armsResolve?.(id));
    pushLoad(`${id}:weapon`, weaponResolve?.(id));
  }
  await Promise.all(loads);
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
        // Drain shot events to trigger fire animations with authoritative
        // target + weapon class. Must run AFTER syncUnits so nodes exist
        // for any shooter just spawned by initMission.
        if (s.fireEvents.length > 0) {
          if (spritesReady) applyFireEvents(unitNodes, s.fireEvents);
          useCombatStore.setState({ fireEvents: [] });
        }
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

/**
 * Tile palettes per biome. Each entry is a complete set — fills for every
 * tile kind plus the stroke colors used on the diamond outline and the
 * raised cover rectangles. Pick one via `paletteFor(map.tileset)`.
 */
type TilePalette = {
  floor: readonly [number, number, number]; // three variants for floor mottle
  floorStroke: number;
  wall: number;
  wallHighlight: number;      // top rim of walls (sun-hit edge).
  wallStain: number;          // weathering drip color.
  halfCover: number;
  fullCover: number;
  coverHighlight: number;     // top rim of raised cover.
  coverShade: number;         // shaded right side of raised cover.
  coverStroke: number;
  accent: number;             // pebble flecks / brick seams.
  accentLight: number;        // highlight flecks / chips of pale sand.
  rimHighlight: number;       // NE edge of floor diamonds (sun hint).
};

const URBAN_PALETTE: TilePalette = {
  floor: [0x1b2331, 0x202a3c, 0x1a2230],
  floorStroke: 0x2a3447,
  wall: 0x0b0f14,
  wallHighlight: 0x1a2230,
  wallStain: 0x050709,
  halfCover: 0x3c5673,
  fullCover: 0x5a7498,
  coverHighlight: 0x7aa0c8,
  coverShade: 0x2e445c,
  coverStroke: 0x0b0f14,
  accent: 0x2a3447,
  accentLight: 0x465a7b,
  rimHighlight: 0x2f3d55,
};

const DESERT_PALETTE: TilePalette = {
  floor: [0xd4b37a, 0xc3a066, 0xb18850], // pale dune / sand / ochre patch
  floorStroke: 0x7a5c30,
  wall: 0x4a3520,                         // weathered adobe
  wallHighlight: 0x8a6838,                // sun-hit top ridge of adobe
  wallStain: 0x2a1a0a,                    // dark weathering drips
  halfCover: 0xa97947,                    // broken clay brick
  fullCover: 0xd09355,                    // taller sandstone column
  coverHighlight: 0xe8c488,               // gold-lit top surface
  coverShade: 0x704a20,                   // shaded right side
  coverStroke: 0x3a2814,
  accent: 0x6a4a22,                       // dark pebble / crack
  accentLight: 0xe8c488,                  // pale chip / bleached highlight
  rimHighlight: 0xe0c089,                 // golden sunlit NE edge
};

function paletteFor(tileset: GridMap['tileset']): TilePalette {
  return tileset === 'desert' ? DESERT_PALETTE : URBAN_PALETTE;
}

function drawMap(layer: Container, map: GridMap) {
  layer.removeChildren();
  const pal = paletteFor(map.tileset);
  const desert = map.tileset === 'desert';
  const g = new Graphics();
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const t = tileAt(map, x, y)!;
      const p = gridToScreen({ x, y });
      const variant = (t.variant ?? 0) % 3;
      let fill = pal.floor[0];
      if (t.kind === 'floor') fill = pal.floor[variant];
      else if (t.kind === 'wall') fill = pal.wall;
      else if (t.kind === 'cover_half') fill = pal.halfCover;
      else if (t.kind === 'cover_full') fill = pal.fullCover;
      diamond(g, p.x, p.y, fill, 1, pal.floorStroke);
      // Biome-specific detail pass — sandstone bricks, dune flecks, etc.
      if (desert) {
        drawDesertDetail(g, t.kind, variant, p.x, p.y, x, y, pal);
      }
      if (t.kind === 'cover_half' || t.kind === 'cover_full') {
        const h = t.kind === 'cover_full' ? 22 : 12;
        g.rect(p.x - 14, p.y - h, 28, h)
          .fill({ color: fill, alpha: 0.95 })
          .stroke({ color: pal.coverStroke, width: 1 });
        if (desert) drawDesertCoverDetail(g, t.kind, p.x, p.y, h, x, y, pal);
      }
    }
  }
  layer.addChild(g);
}

/**
 * Per-tile desert floor / wall detail. Deterministic by (x, y) so the map
 * holds still — every time the scene redraws, the same pebbles / cracks /
 * dunes sit in the same spots.
 *
 * Three floor variants carry three distinct characters:
 *   - variant 0: plain sand — scattered pebble flecks.
 *   - variant 1: wind-drift sand — pebbles + a curving sand trail.
 *   - variant 2: cracked earth — a branching crack pattern.
 * All floor tiles also get a golden rim-highlight on the north-east edge
 * to hint at a shared sun direction.
 *
 * Walls get three brick courses, a top sun highlight, and occasional
 * vertical weather-drip stains so they read as weathered adobe.
 */
function drawDesertDetail(
  g: Graphics, kind: TileKind, variant: number,
  px: number, py: number, gx: number, gy: number, pal: TilePalette,
) {
  // Deterministic hash for per-tile variety. Cheap, stable across renders.
  const h = (gx * 73856093 ^ gy * 19349663) >>> 0;
  const rand = (salt: number) => ((h + salt * 2654435761) >>> 0) / 0xffffffff;

  if (kind === 'floor') {
    // Golden rim on the NE edge — fakes a consistent sunlight direction.
    g.moveTo(px, py - TILE_H / 2);
    g.lineTo(px + TILE_W / 2, py);
    g.stroke({ color: pal.rimHighlight, width: 0.8, alpha: 0.45 });

    // Scatter 2–3 pebble flecks (mix of dark and bleached chips).
    const n = ((h >>> 4) % 2) + 2;
    for (let i = 0; i < n; i++) {
      const dx = (rand(i * 3 + 1) * 18 - 9) | 0;
      const dy = (rand(i * 3 + 2) * 8 - 4) | 0;
      const r = 0.7 + rand(i * 3 + 3) * 0.6;
      const light = rand(i * 3 + 4) < 0.35;
      g.circle(px + dx, py + dy, r).fill({
        color: light ? pal.accentLight : pal.accent,
        alpha: light ? 0.55 : 0.65,
      });
    }

    if (variant === 1) {
      // Wind-drift sand — two soft drift streaks sweeping across the tile.
      g.moveTo(px - 12, py + 2);
      g.quadraticCurveTo(px, py - 2, px + 12, py + 2);
      g.stroke({ color: pal.accentLight, width: 0.7, alpha: 0.45 });
      g.moveTo(px - 9, py + 4);
      g.quadraticCurveTo(px, py + 1, px + 9, py + 4);
      g.stroke({ color: pal.accent, width: 0.5, alpha: 0.4 });
    } else if (variant === 2) {
      // Cracked earth — main crack with two small branches.
      g.moveTo(px - 10, py + 1);
      g.lineTo(px - 3, py - 1);
      g.lineTo(px + 4, py + 2);
      g.lineTo(px + 11, py - 1);
      g.stroke({ color: pal.accent, width: 0.7, alpha: 0.6 });
      // branch off the midpoint
      g.moveTo(px - 3, py - 1);
      g.lineTo(px - 1, py + 3);
      g.stroke({ color: pal.accent, width: 0.5, alpha: 0.5 });
      g.moveTo(px + 4, py + 2);
      g.lineTo(px + 6, py - 2);
      g.stroke({ color: pal.accent, width: 0.5, alpha: 0.5 });
    }

    // Occasional pottery shard — small triangular sliver, once in ~8 tiles.
    if (rand(9) < 0.12) {
      const sx = px + (rand(10) * 10 - 5);
      const sy = py + (rand(11) * 4 - 2);
      g.poly([sx - 2, sy, sx + 1, sy - 2, sx + 2, sy + 1])
        .fill({ color: pal.coverStroke, alpha: 0.55 })
        .stroke({ color: pal.accent, width: 0.4, alpha: 0.7 });
    }
  } else if (kind === 'wall') {
    // Three brick courses at regular spacing, top course thinner to imply
    // coping stones at the parapet.
    g.rect(px - 10, py - 4, 20, 0.7).fill({ color: pal.accent, alpha: 0.6 });
    g.rect(px - 10, py - 1, 20, 0.7).fill({ color: pal.accent, alpha: 0.6 });
    g.rect(px - 10, py + 3, 20, 0.7).fill({ color: pal.accent, alpha: 0.6 });
    // Staggered vertical seams between courses for brick realism.
    g.rect(px - 4, py - 4, 0.6, 3).fill({ color: pal.accent, alpha: 0.55 });
    g.rect(px + 2, py - 1, 0.6, 4).fill({ color: pal.accent, alpha: 0.55 });
    g.rect(px - 6, py + 3, 0.6, 3).fill({ color: pal.accent, alpha: 0.55 });
    // Top sun highlight — reuse the diamond top edge.
    g.moveTo(px - TILE_W / 2, py);
    g.lineTo(px, py - TILE_H / 2);
    g.stroke({ color: pal.wallHighlight, width: 1.1, alpha: 0.7 });
    g.moveTo(px, py - TILE_H / 2);
    g.lineTo(px + TILE_W / 2, py);
    g.stroke({ color: pal.wallHighlight, width: 1.1, alpha: 0.6 });
    // Occasional vertical weathering drip.
    if (rand(20) < 0.3) {
      const dx = (rand(21) * 16 - 8) | 0;
      g.rect(px + dx, py - 4, 0.5, 7).fill({ color: pal.wallStain, alpha: 0.55 });
    }
  }
}

/**
 * Adobe masonry on raised cover: horizontal brick courses + a centered
 * decorative seam, top sun highlight, and a right-side shadow band so the
 * pillar reads as 3D rather than a flat colored block. Full cover also
 * gets vertical seams and a mid-band cornice.
 */
function drawDesertCoverDetail(
  g: Graphics, kind: TileKind,
  px: number, py: number, h: number, gx: number, gy: number, pal: TilePalette,
) {
  const left = px - 14, right = px + 14, top = py - h, bot = py;
  // Top sun-lit strip.
  g.rect(left, top, 28, 1.2).fill({ color: pal.coverHighlight, alpha: 0.85 });
  // Right-side shadow column.
  g.rect(right - 2.5, top + 1.2, 2.5, h - 1.2)
    .fill({ color: pal.coverShade, alpha: 0.55 });

  // Brick courses — spaced every 4px. The seam at each course uses the
  // stroke colour for a subtle recessed line.
  for (let y = top + 4; y < bot; y += 4) {
    g.rect(left, y, 28, 0.6).fill({ color: pal.coverStroke, alpha: 0.55 });
  }
  // Staggered vertical seams per course to suggest offset brick laying.
  const hash = ((gx * 31 + gy * 17) >>> 0);
  for (let i = 0, y = top + 4; y < bot; y += 4, i++) {
    const seamX = left + 6 + ((hash + i * 7) % 14);
    g.rect(seamX, y - 4, 0.6, 4).fill({ color: pal.coverStroke, alpha: 0.5 });
  }

  if (kind === 'cover_full') {
    // Mid-band cornice — a slight ledge across the column.
    const mid = Math.round(top + h * 0.45);
    g.rect(left - 1, mid, 30, 1.4).fill({ color: pal.coverHighlight, alpha: 0.7 });
    g.rect(left - 1, mid + 1.4, 30, 0.6).fill({ color: pal.coverStroke, alpha: 0.7 });
    // Two dominant vertical seams for the column structure.
    g.rect(left + 9, top, 0.6, h).fill({ color: pal.coverStroke, alpha: 0.55 });
    g.rect(left + 19, top, 0.6, h).fill({ color: pal.coverStroke, alpha: 0.55 });
  }
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

/** Durations (ms) for movement / hit / death animations. */
const MOVE_TWEEN_MS = 260;
const HIT_FLASH_MS = 240;
const DEATH_DURATION_MS = 560;

/**
 * Per-weapon-class fire choreography. Drives how long the windup is, how
 * far the weapon rotates, how many shots fire (bursts for heavy/SMG), and
 * how big the muzzle flash reads.
 *
 * All phase durations are absolute ms (not fractions) so a burst-fire
 * heavy can hold a long shot window while a sniper still gets a short
 * single flash after a deliberate windup.
 */
type FireStyle = {
  totalMs: number;
  windupMs: number;
  shotSpacingMs: number;  // ms between shot starts (0 for single-shot).
  shotWindowMs: number;   // how long each individual flash is visible.
  shots: number;
  windupRad: number;      // weapon rotation at end of windup (radians, positive = muzzle-up).
  kickRad: number;        // additional rotation at each shot (recoil).
  recoilPx: number;       // body kick-back distance on each shot.
  /**
   * How far the weapon grip lifts toward eye level during aim (pixels,
   * positive = up). The body stays planted; the arms/weapon move
   * independently so the unit "brings the gun up" rather than the whole
   * silhouette lurching. Snipers and rifles lift the most (cheek-weld);
   * the heavy keeps the gun shouldered and barely moves.
   */
  weaponLiftPx: number;
  flashScale: number;     // size multiplier for drawMuzzleFlash.
};

/**
 * Rifle: Ranger brings the carbine up to cheekweld (big lift + rotation)
 *        before a single crisp shot.
 * Heavy: Warden keeps the autocannon shouldered; minimal lift, rapid
 *        flashes, low per-shot rotation.
 * Shotgun: Sapper's short windup with a strong chest-level raise, then
 *          one thundering wide blast with a big kick.
 * Sniper: Mystic's deliberate windup — weapon fully raised to the eye,
 *         single decisive shot.
 */
const FIRE_STYLES: Record<WeaponClass | 'default', FireStyle> = {
  rifle:   { totalMs: 560, windupMs: 300, shotSpacingMs: 0,  shotWindowMs: 90,  shots: 1, windupRad: 0.55, kickRad: 0.32, recoilPx: 4, weaponLiftPx: 13, flashScale: 1.0 },
  sniper:  { totalMs: 720, windupMs: 430, shotSpacingMs: 0,  shotWindowMs: 100, shots: 1, windupRad: 0.72, kickRad: 0.40, recoilPx: 5, weaponLiftPx: 16, flashScale: 1.1 },
  shotgun: { totalMs: 520, windupMs: 200, shotSpacingMs: 0,  shotWindowMs: 140, shots: 1, windupRad: 0.42, kickRad: 0.55, recoilPx: 9, weaponLiftPx: 10, flashScale: 2.0 },
  heavy:   { totalMs: 680, windupMs: 110, shotSpacingMs: 80, shotWindowMs: 55,  shots: 4, windupRad: 0.24, kickRad: 0.12, recoilPx: 2, weaponLiftPx:  5, flashScale: 0.9 },
  smg:     { totalMs: 500, windupMs: 120, shotSpacingMs: 60, shotWindowMs: 45,  shots: 3, windupRad: 0.38, kickRad: 0.18, recoilPx: 2, weaponLiftPx:  9, flashScale: 0.8 },
  pistol:  { totalMs: 400, windupMs: 170, shotSpacingMs: 0,  shotWindowMs: 80,  shots: 1, windupRad: 0.45, kickRad: 0.28, recoilPx: 3, weaponLiftPx:  9, flashScale: 0.8 },
  default: { totalMs: 440, windupMs: 200, shotSpacingMs: 0,  shotWindowMs: 90,  shots: 1, windupRad: 0.48, kickRad: 0.30, recoilPx: 3, weaponLiftPx: 10, flashScale: 1.0 },
};

/**
 * Drain pending FireEvents and trigger the correct animation on each
 * shooter's node. Events are authoritative (they carry the actual
 * target and weapon class from the combat resolvers), so the renderer
 * doesn't have to guess from ammo deltas or "nearest enemy" heuristics.
 */
function applyFireEvents(nodes: Map<UnitId, UnitNode>, events: FireEvent[]) {
  for (const evt of events) {
    const node = nodes.get(evt.shooterId);
    if (!node) continue;
    const from = gridToScreen(evt.shooterPos);
    const to = gridToScreen(evt.targetPos);
    const dx = to.x - from.x, dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    node.fireTargetDir = { x: dx / len, y: dy / len };
    node.fireStyle = FIRE_STYLES[evt.fireClass] ?? FIRE_STYLES.default;
    node.fireAnimMs = node.fireStyle.totalMs;
    if (Math.abs(dx) > 0.5) node.facing = dx > 0 ? 1 : -1;
  }
}

/**
 * Grip pivot for the weapon layer, expressed as a fraction of the sprite's
 * 96×128 viewBox. The weapon sprite's anchor is set here so rotating it
 * pivots around the character's hand. This is a reasonable generic for all
 * seven Eagle Corps templates — weapons are authored waist-height, centered.
 */
const GRIP_ANCHOR = { x: 0.5, y: 0.56 };

/** Muzzle position in weapon-wrap local coords (right-facing). Mirrored for left. */
const MUZZLE_OFFSET = { x: 22, y: -2 };

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
    updateUnitNode(node, u, u.id === st.selectedId);
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

  // Shadow is a child of container (not body) so it doesn't lean during walk/fire.
  const shadow = new Graphics();
  shadow.ellipse(0, 6, 14, 6).fill({ color: 0x000000, alpha: 0.45 });

  const selectionRing = new Graphics();

  // Body holds the sprite — this is what rotates/scales during walk cycles.
  const body = new Container();

  let sprite: Sprite | null = null;
  let fallback: Graphics | null = null;
  let weaponWrap: Container | null = null;
  let weaponSprite: Sprite | null = null;
  let armsSprite: Sprite | null = null;
  let weaponRestY = 0;
  let spriteTop: number;

  const bodyTex = spriteCache.get(`${u.templateId}:body`);
  const armsTex = spriteCache.get(`${u.templateId}:arms`);
  const weaponTex = spriteCache.get(`${u.templateId}:weapon`);

  if (bodyTex) {
    sprite = new Sprite(bodyTex);
    sprite.anchor.set(0.5, 1);
    sprite.scale.set(0.42);
    sprite.position.set(0, 4);
    body.addChild(sprite);
    spriteTop = -50;

    // Weapon rides on top of the body. We use a wrap whose origin sits at the
    // character's grip — rotating the wrap then pivots the weapon around the
    // hand. The weapon sprite is anchored at GRIP_ANCHOR so its internal
    // coordinates stay aligned with the body's 96×128 viewBox.
    if (weaponTex) {
      weaponWrap = new Container();
      // Place the wrap at the grip's screen-space location inside the body.
      // Grip viewBox coords = (GRIP_ANCHOR.x*96, GRIP_ANCHOR.y*128). Body
      // sprite renders viewBox → local via anchor (0.5, 1) at position (0, 4),
      // so grip local = ((0.5-0.5)*96*0.42, (0.56-1)*128*0.42 + 4) = (0, -19.64).
      weaponRestY = (GRIP_ANCHOR.y - 1) * 128 * 0.42 + 4;
      // GRIP_ANCHOR.x = 0.5 → rest X is always 0 (centered on the body).
      weaponWrap.position.set(0, weaponRestY);

      // Arms ride inside the weapon wrap so they lift + rotate together
      // with the gun. Same anchor / scale as the weapon so the authored
      // 96×128 coordinates stay aligned with the torso's viewBox.
      if (armsTex) {
        armsSprite = new Sprite(armsTex);
        armsSprite.anchor.set(GRIP_ANCHOR.x, GRIP_ANCHOR.y);
        armsSprite.scale.set(0.42);
        weaponWrap.addChild(armsSprite);
      }

      weaponSprite = new Sprite(weaponTex);
      weaponSprite.anchor.set(GRIP_ANCHOR.x, GRIP_ANCHOR.y);
      weaponSprite.scale.set(0.42);
      weaponWrap.addChild(weaponSprite);
      body.addChild(weaponWrap);
    }
  } else {
    fallback = new Graphics();
    const color = parseInt(u.color.slice(1), 16);
    fallback.roundRect(-10, -30, 20, 30, 4).fill(color).stroke({ color: 0x0b0f14, width: 1 });
    fallback.circle(0, -36, 8).fill(color).stroke({ color: 0x0b0f14, width: 1 });
    body.addChild(fallback);
    spriteTop = -44;
  }

  // Muzzle flash is a child of the weapon wrap (when present) so it rotates
  // with the weapon and sits at the barrel tip. When there's no weapon wrap
  // it attaches to the container directly as a fallback.
  const muzzleFlash = new Graphics();
  if (weaponWrap) weaponWrap.addChild(muzzleFlash);

  const hpBar = new Graphics();
  const label = new Text({
    text: '',
    style: { fill: 0xaab4c4, fontSize: 10, fontFamily: 'system-ui' },
  });
  label.anchor.set(0.5, 1);
  const ornaments = new Container();

  if (weaponWrap) {
    container.addChild(shadow, selectionRing, body, ornaments, hpBar, label);
  } else {
    container.addChild(shadow, selectionRing, body, muzzleFlash, ornaments, hpBar, label);
  }

  const p = gridToScreen(u.pos);
  container.position.set(p.x, p.y);

  return {
    container, shadow, body, sprite, fallback, weaponWrap, weaponSprite, armsSprite,
    weaponRestY, muzzleFlash,
    hpBar, label, ornaments, selectionRing, spriteTop,
    currentScreen: { x: p.x, y: p.y },
    targetScreen: { x: p.x, y: p.y },
    moveMs: 0, moveDurationMs: 0,
    facing: 1,
    prevHp: u.hp,
    hitFlashMs: 0,
    fireAnimMs: 0,
    fireStyle: FIRE_STYLES.default,
    fireTargetDir: { x: 1, y: 0 },
    deathMs: u.alive ? null : 0,
    selected: false,
    bobPhase: Math.random() * Math.PI * 2,
  };
}

function updateUnitNode(node: UnitNode, u: Unit, selected: boolean) {
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

  // (Fire-animation triggers are driven by FireEvent stream, not ammo deltas —
  // see applyFireEvents() below. Ammo tracking is no longer needed here.)

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


/**
 * Per-frame animation update. Reads each node's pending timers and builds
 * a composite body transform + muzzle-flash draw for this frame.
 *
 * Animation channels (additive):
 *  - movement lerp + walk cycle (lean, step-bob, squash — two steps per tile)
 *  - idle bob + selected pulse (when stationary)
 *  - fire sequence (windup → muzzle flash at shot moment → recoil → return)
 *  - hit flash (red tint + horizontal jitter)
 *  - death fade (alpha + slump + fall-sideways rotation)
 */
function tickUnitAnimations(
  layer: Container,
  nodes: Map<UnitId, UnitNode>,
  dtMs: number,
  nowMs: number
) {
  for (const node of nodes.values()) {
    // ----- Movement interpolation.
    if (node.moveDurationMs > 0) {
      node.moveMs += dtMs;
      const raw = Math.min(1, node.moveMs / node.moveDurationMs);
      const tE = easeOutQuad(raw);
      const sx = node.currentScreen.x + (node.targetScreen.x - node.currentScreen.x) * tE;
      const sy = node.currentScreen.y + (node.targetScreen.y - node.currentScreen.y) * tE;
      node.container.position.set(sx, sy);
      if (raw >= 1) {
        node.currentScreen = { x: node.targetScreen.x, y: node.targetScreen.y };
        node.moveDurationMs = 0;
        node.moveMs = 0;
      }
    }

    const alive = node.deathMs === null;
    const moving = node.moveDurationMs > 0;

    // ----- Walk cycle (while moving): lean + two-step bob + squash on foot-plants.
    // walkSway is an independent weapon rotation that counter-balances the lean.
    let walkLean = 0, walkBob = 0, walkScaleY = 1, walkSway = 0;
    if (moving && alive) {
      const raw = node.moveMs / node.moveDurationMs;
      // Two steps per tile → 4 half-cycles.
      walkLean = Math.sin(raw * Math.PI * 2) * 0.08; // ±4.6°
      walkBob = -Math.abs(Math.sin(raw * Math.PI * 4)) * 2.5; // body lifts on stride peak
      walkScaleY = 1 - Math.abs(Math.sin(raw * Math.PI * 4 - Math.PI / 2)) * 0.05; // squash on plant
      walkSway = -walkLean * 0.6; // weapon lags/opposes the body swing
    }

    // Idle is deliberately STILL — a hovering idle animation reads as
    // "floating" in an isometric tactical view. The selection ring alpha
    // pulses (further below) to indicate the active unit instead of any
    // character-body motion.

    // ----- Fire sequence: windup → one-or-more shots → return.
    // Only the weapon (arm+gun) lifts toward eye level and rotates into
    // aim; the body holds still except for a small recoil push-back on
    // each shot. This reads as "arms move independently of the torso."
    let bodyPitch = 0, bodyPushX = 0, bodyPushY = 0;
    let weaponAim = 0, weaponLift = 0, flashIntensity = 0;
    if (node.fireAnimMs > 0) {
      node.fireAnimMs = Math.max(0, node.fireAnimMs - dtMs);
      const style = node.fireStyle;
      const elapsed = style.totalMs - node.fireAnimMs;
      const burstSpanMs = style.shots > 1
        ? (style.shots - 1) * style.shotSpacingMs + style.shotWindowMs
        : style.shotWindowMs;
      const returnStart = style.windupMs + burstSpanMs;
      const returnMs = Math.max(1, style.totalMs - returnStart);

      if (elapsed < style.windupMs) {
        // Windup: arms raise the weapon up (lift) and angle it toward the
        // target (rotation). Body is still.
        const p = elapsed / style.windupMs;
        const ease = easeOutQuad(p);
        weaponAim = -style.windupRad * node.facing * ease;
        weaponLift = -style.weaponLiftPx * ease;
      } else if (elapsed < returnStart) {
        // Shot phase: hold weapon at aim + flash/kick for each active shot.
        const shotPhase = elapsed - style.windupMs;
        let flashP = -1;
        for (let i = 0; i < style.shots; i++) {
          const start = i * style.shotSpacingMs;
          if (shotPhase >= start && shotPhase < start + style.shotWindowMs) {
            flashP = (shotPhase - start) / style.shotWindowMs;
            break;
          }
        }
        weaponAim = -style.windupRad * node.facing;
        weaponLift = -style.weaponLiftPx;
        if (flashP >= 0) {
          // Active shot: muzzle flash + recoil on both arm and body.
          flashIntensity = 1 - flashP;
          const kick = 1 - flashP;
          weaponAim += -style.kickRad * node.facing * kick;
          weaponLift -= 2 * kick; // weapon jerks up on recoil
          bodyPitch = 0.025 * node.facing * kick; // subtle torso reaction
          bodyPushX = -node.fireTargetDir.x * style.recoilPx * kick;
          bodyPushY = -node.fireTargetDir.y * style.recoilPx * kick;
        }
      } else {
        // Return: weapon eases back to low-ready, body settles.
        const p = (elapsed - returnStart) / returnMs;
        const ret = 1 - easeOutQuad(Math.min(1, p));
        weaponAim = -style.windupRad * node.facing * ret * 0.5;
        weaponLift = -style.weaponLiftPx * ret;
      }
    }

    // ----- Hit flash: tint + jitter.
    let jitterX = 0;
    if (node.hitFlashMs > 0) {
      node.hitFlashMs = Math.max(0, node.hitFlashMs - dtMs);
      const a = node.hitFlashMs / HIT_FLASH_MS;
      jitterX = (Math.random() - 0.5) * 3 * a;
      applyTint(node, blendRed(a));
    } else {
      applyTint(node, 0xffffff);
    }

    // ----- Compose body transform. Body is unaffected by fire windup —
    // only by walk cycle + hit-jitter + recoil push-back (bodyPush*).
    node.body.scale.set(node.facing, walkScaleY);
    node.body.rotation = walkLean + bodyPitch;
    node.body.position.x = jitterX + bodyPushX;
    node.body.position.y = walkBob + bodyPushY;

    // ----- Selection ring alpha pulse — drives the "who's active" cue
    // since the character body itself is static in idle.
    if (node.selected && node.deathMs === null) {
      node.selectionRing.alpha = 0.55 + Math.sin(nowMs * 0.004) * 0.35;
    }

    // ----- Weapon transform. The arms/gun move independently of the
    // body: `weaponAim` rotates around the grip, `weaponLift` raises
    // the whole wrap toward eye level during aim.
    if (node.weaponWrap) {
      node.weaponWrap.rotation = walkSway + weaponAim;
      node.weaponWrap.position.y = node.weaponRestY + weaponLift;
    }

    // ----- Muzzle flash: drawn in weapon-wrap space when available so it
    // follows the rotating barrel. Falls back to container-space otherwise.
    drawMuzzleFlash(
      node.muzzleFlash, node.facing, flashIntensity,
      !!node.weaponWrap, node.fireStyle.flashScale,
    );

    // ----- Death fade: alpha out + slump + slight fall-sideways rotation.
    if (node.deathMs !== null) {
      node.deathMs += dtMs;
      const t = Math.min(1, node.deathMs / DEATH_DURATION_MS);
      node.container.alpha = 1 - t;
      node.body.position.y = t * 14; // overrides live bob — they're dead
      node.body.rotation = node.facing * 0.6 * t; // tip over toward facing
      // Weapon drops below the grip as the character collapses.
      if (node.weaponWrap) {
        node.weaponWrap.rotation = node.facing * 1.2 * t;
        node.weaponWrap.position.y = node.weaponRestY + t * 4;
      }
      node.shadow.alpha = 1 - t * 0.8;
      node.hpBar.visible = false;
      node.label.visible = false;
      node.muzzleFlash.clear();
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

/**
 * Draw a muzzle flash at the weapon tip. `intensity` 0..1 fades the whole
 * composite (star burst + hot core + glow) so the flash blinks on and off.
 *
 * When `inWeaponSpace` is true the graphic lives inside the weapon-wrap
 * (pivot at the grip) — the "tip" offset is measured forward of the grip.
 * Otherwise it's in container-space and sits at a fixed chest-height point.
 */
function drawMuzzleFlash(
  g: Graphics, facing: 1 | -1, intensity: number,
  inWeaponSpace: boolean, scale: number,
) {
  g.clear();
  if (intensity <= 0) return;
  // In weapon-wrap space, origin = grip, so the muzzle is a fixed x forward
  // of origin. In container-space (no split-weapon pack) the flash lives
  // at chest height relative to the character container.
  const x = inWeaponSpace ? MUZZLE_OFFSET.x * facing : 20 * facing;
  const y = inWeaponSpace ? MUZZLE_OFFSET.y : -30;
  const s = scale;
  // Soft outer glow.
  g.circle(x, y, 11 * s).fill({ color: 0xff9a3c, alpha: 0.4 * intensity });
  // 4-point star burst (longer along the barrel axis).
  g.poly([
    x - 14 * s * facing, y,
    x - 2 * s * facing,  y - 3 * s,
    x,                    y - 9 * s,
    x + 2 * s * facing,  y - 3 * s,
    x + 18 * s * facing, y,
    x + 2 * s * facing,  y + 3 * s,
    x,                    y + 9 * s,
    x - 2 * s * facing,  y + 3 * s,
  ]).fill({ color: 0xffe0a0, alpha: 0.85 * intensity });
  // Hot white core.
  g.circle(x, y, 3.5 * s).fill({ color: 0xffffff, alpha: 0.95 * intensity });
}

function applyTint(node: UnitNode, tint: number) {
  if (node.sprite) node.sprite.tint = tint;
  if (node.armsSprite) node.armsSprite.tint = tint;
  if (node.weaponSprite) node.weaponSprite.tint = tint;
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

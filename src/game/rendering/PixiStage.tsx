import { useEffect, useRef } from 'react';
import { Application, Container, Graphics, Text } from 'pixi.js';
import { useCombatStore } from '../../state/combatStore';
import { useContent } from '../../content/registry';
import { soundEngine, type SoundKey } from '../audio/soundEngine';
import type { GridMap, UnitId, Vec2 } from '../types';
import { gridToScreen, screenToGrid } from './isoProjection';
import { chebyshev, keyOf } from '../engine/grid';
import { hasLineOfSight } from '../engine/los';
import { diamond } from './context';
import { drawMap } from './map/drawMap';
import {
  type UnitNode,
  ensureSpritesLoaded,
  syncUnits,
} from './units/UnitNode';
import { applyFireEvents } from './units/fireStyles';
import { tickUnitAnimations } from './units/animate';


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
        background: '#0e1a20',
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
      let lastMap = initialState.map;
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
        if (st.mode === 'ability') {
          // Route the tap to the selected soldier's class-specific ability.
          // (The HUD button set ability-mode only for targeting classes —
          // Mystic's Arcane Sight fires instantly from the HUD and never
          // leaves us in this mode.)
          const sel = st.units.find((u) => u.id === st.selectedId);
          if (!sel) { st.setMode('idle'); return; }
          const tmpl = useContent().soldierTemplates[sel.templateId];
          if (tmpl?.class === 'Ranger') {
            if (unitAt && unitAt.faction === 'enemy') st.tryRangerMark(unitAt.id);
            else st.setMode('idle');
            return;
          }
          if (tmpl?.class === 'Warden') {
            if (unitAt && unitAt.faction === 'enemy') st.tryWardenBracingFire(unitAt.id);
            else st.setMode('idle');
            return;
          }
          if (tmpl?.class === 'Sapper') {
            st.trySapperDemolish(g);
            return;
          }
          st.setMode('idle');
        }
      }

      // Re-render reactive layers whenever the store changes.
      // Floaters are drained to a local list so ticker animation doesn't churn
      // the store every frame.
      type ActiveFloater = { text: string; color: number; pos: Vec2; bornMs: number };
      const active: ActiveFloater[] = [];
      const FLOATER_MS = 900;

      // Per-impact blood spurts. One entry holds a pre-rolled set of droplets
      // with initial velocities; the ticker integrates them + renders.
      type BloodDroplet = { x: number; y: number; vx: number; vy: number; r: number };
      type ActiveBlood = { bornMs: number; droplets: BloodDroplet[] };
      const bloods: ActiveBlood[] = [];
      const BLOOD_MS = 620;

      function spawnBlood(pos: Vec2, damage: number) {
        const origin = gridToScreen(pos);
        // One droplet per ~2 damage, clamped 3..8 so a 1-dmg pistol tap still
        // reads as a hit and a 12-dmg sniper doesn't flood the screen.
        const count = Math.max(3, Math.min(8, 2 + Math.round(damage / 2)));
        const droplets: BloodDroplet[] = [];
        for (let i = 0; i < count; i++) {
          // Spray biased upward + outward; gravity arcs them back down.
          const angle = (Math.random() * 1.2 - 0.6) - Math.PI / 2; // -162° .. -108°
          const speed = 70 + Math.random() * 70;                   // 70..140 px/s
          droplets.push({
            x: origin.x + (Math.random() - 0.5) * 4,
            y: origin.y - 26 + (Math.random() - 0.5) * 6,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            r: 1.6 + Math.random() * 1.4,
          });
        }
        bloods.push({ bornMs: performance.now(), droplets });
        // "Crit" shorthand: any hit dealing 8+ damage gets the
        // punchier crit sound; smaller hits play the standard hit
        // clip. Kill SFX is layered on top in the subscriber below
        // when HP drops to zero.
        soundEngine.play(damage >= 8 ? 'crit' : 'hit');
      }

      let lastPhase = useCombatStore.getState().phase;
      let lastRound = useCombatStore.getState().round;
      const unsub = useCombatStore.subscribe(() => {
        const s = useCombatStore.getState();
        // Phase + round transition stingers. Round-start fires only
        // for rounds ≥ 2 so the initial deploy doesn't blast audio
        // before the screen even settles.
        if (s.phase !== lastPhase) {
          if (s.phase === 'won') soundEngine.play('victory');
          else if (s.phase === 'lost') soundEngine.play('defeat');
          lastPhase = s.phase;
        }
        if (s.round !== lastRound && s.round > 1 && s.phase === 'player') {
          soundEngine.play('round.start');
          lastRound = s.round;
        }
        if (s.floaters.length > 0) {
          const now = performance.now();
          for (const f of s.floaters) active.push({ text: f.text, color: f.color, pos: f.pos, bornMs: now });
          useCombatStore.setState({ floaters: [] });
        }
        // The map is immutable during a mission except for destructible
        // cover (grenades, demolish ability). Reference equality is
        // enough to catch those swaps.
        if (s.map !== lastMap) {
          lastMap = s.map;
          drawMap(tileLayer, s.map);
        }
        redrawOverlays(overlayLayer, s);
        if (spritesReady) syncUnits(unitLayer, unitNodes, s, spawnBlood);
        // Drain shot events to trigger fire animations with authoritative
        // target + weapon class. Must run AFTER syncUnits so nodes exist
        // for any shooter just spawned by initMission.
        if (s.fireEvents.length > 0) {
          if (spritesReady) applyFireEvents(unitNodes, s.fireEvents);
          // Fire SFX keyed by fireClass — e.g. 'shot.rifle' / 'shot.heavy'.
          // Missing assets silently no-op so the game still plays if
          // the audio directory is incomplete.
          for (const evt of s.fireEvents) {
            soundEngine.play(`shot.${evt.fireClass}` as SoundKey);
          }
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

        // Integrate blood droplet physics + drop expired bloods.
        const dtSec = dtMs / 1000;
        const GRAVITY = 600; // px/s²
        for (const b of bloods) {
          for (const d of b.droplets) {
            d.x += d.vx * dtSec;
            d.y += d.vy * dtSec;
            d.vy += GRAVITY * dtSec;
          }
        }
        for (let i = bloods.length - 1; i >= 0; i--) {
          if (now - bloods[i].bornMs > BLOOD_MS) bloods.splice(i, 1);
        }
        // Prune aged floaters in the local list, then render both layers.
        for (let i = active.length - 1; i >= 0; i--) {
          if (now - active[i].bornMs > FLOATER_MS) active.splice(i, 1);
        }
        renderFx(fxLayer, active, bloods, now, FLOATER_MS, BLOOD_MS);
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
      // Gold for 1-AP (primary "your reach"), copper for 2-AP (stretched).
      // Both tones harmonise with the desert palette instead of fighting
      // it like the old blue/yellow pair did.
      const color = apCost <= 1 ? 0xe8c488 : 0xc87846;
      diamond(g, p.x, p.y, color, 0.22, color);
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

/**
 * Per-frame pass over the fx layer: draws active blood-spurt droplets
 * underneath damage-number floaters, then clears and redraws the layer
 * in a single removeChildren call. Ticker integrates the droplet
 * positions + prunes aged entries before this runs.
 */
function renderFx(
  layer: Container,
  floaters: Array<{ text: string; color: number; pos: Vec2; bornMs: number }>,
  bloods: Array<{ bornMs: number; droplets: Array<{ x: number; y: number; vx: number; vy: number; r: number }> }>,
  now: number,
  floaterTotalMs: number,
  bloodTotalMs: number,
) {
  layer.removeChildren();
  // Blood first so damage numbers read on top.
  if (bloods.length > 0) {
    const g = new Graphics();
    for (const b of bloods) {
      const age = now - b.bornMs;
      // Keep full alpha for the first third, fade through the rest.
      const alpha = age < bloodTotalMs * 0.33
        ? 1
        : Math.max(0, 1 - (age - bloodTotalMs * 0.33) / (bloodTotalMs * 0.67));
      if (alpha <= 0) continue;
      for (const d of b.droplets) {
        // Darker core + lighter rim for a bit of shape at small sizes.
        g.circle(d.x, d.y, d.r * 1.25).fill({ color: 0x5a0808, alpha: alpha * 0.9 });
        g.circle(d.x, d.y, d.r).fill({ color: 0xb21a1a, alpha });
      }
    }
    layer.addChild(g);
  }
  // Damage numbers.
  for (const f of floaters) {
    const progress = Math.min(1, (now - f.bornMs) / floaterTotalMs);
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

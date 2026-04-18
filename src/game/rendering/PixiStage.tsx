import { useEffect, useRef } from 'react';
import { Application, Container, Graphics, Text } from 'pixi.js';
import { useCombatStore } from '../../state/combatStore';
import type { GridMap, Unit, Vec2 } from '../types';
import { TILE_W, TILE_H, gridToScreen, screenToGrid } from './isoProjection';
import { chebyshev, keyOf, tileAt } from '../engine/grid';
import { hasLineOfSight } from '../engine/los';

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
      const overlayLayer = new Container(); // reach/AoE/targets
      const unitLayer = new Container();
      const fxLayer = new Container();
      world.addChild(tileLayer, overlayLayer, unitLayer, fxLayer);
      app.stage.addChild(world);

      // Camera state
      const cam = { x: app.screen.width / 2, y: 80, zoom: 1 };
      const applyCam = () => {
        world.position.set(cam.x + shakeOffset.x, cam.y + shakeOffset.y);
        world.scale.set(cam.zoom);
      };
      const shakeOffset = { x: 0, y: 0 };

      // Initial store draw
      const initialState = useCombatStore.getState();
      drawMap(tileLayer, initialState.map);
      applyCam();

      // ---- Input: touch pan, pinch zoom, tap-to-resolve ----
      let pointers = new Map<number, { x: number; y: number }>();
      let lastTap = { x: 0, y: 0, t: 0 };
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
          const dx = e.clientX - panStart.px;
          const dy = e.clientY - panStart.py;
          if (Math.hypot(dx, dy) > 6) dragged = true;
          cam.x = panStart.cx + dx;
          cam.y = panStart.cy + dy;
          applyCam();
        } else if (pointers.size === 2 && pinchStart) {
          const pts = [...pointers.values()];
          const dx = pts[0].x - pts[1].x, dy = pts[0].y - pts[1].y;
          const d = Math.hypot(dx, dy);
          const z = Math.max(0.5, Math.min(2.2, pinchStart.zoom * (d / pinchStart.dist)));
          cam.zoom = z;
          dragged = true;
          applyCam();
        }
      };
      const onUp = (e: PointerEvent) => {
        const hadTwo = pointers.size === 2;
        pointers.delete(e.pointerId);
        if (!hadTwo && !dragged) {
          // Tap resolved: translate screen to grid and dispatch.
          const rect = app.canvas.getBoundingClientRect();
          const sx = e.clientX - rect.left;
          const sy = e.clientY - rect.top;
          const w = screenToWorld(sx, sy);
          const g = screenToGrid(w);
          onTapGrid(g);
          lastTap = { x: g.x, y: g.y, t: performance.now() };
        }
        if (pointers.size < 2) pinchStart = null;
        if (pointers.size === 0) panStart = null;
      };
      app.canvas.addEventListener('pointerdown', onDown);
      app.canvas.addEventListener('pointermove', onMove);
      app.canvas.addEventListener('pointerup', onUp);
      app.canvas.addEventListener('pointercancel', onUp);
      // Mouse wheel zoom for desktop.
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        cam.zoom = Math.max(0.5, Math.min(2.2, cam.zoom * factor));
        applyCam();
      };
      app.canvas.addEventListener('wheel', onWheel, { passive: false });

      function onTapGrid(g: Vec2) {
        const st = useCombatStore.getState();
        if (!inMap(st.map, g)) return;
        // If a non-selected unit is under the tap, route correctly.
        const unitAt = st.units.find((u) => u.alive && u.pos.x === g.x && u.pos.y === g.y);
        if (st.mode === 'idle') {
          if (unitAt && unitAt.faction === 'player') { st.selectUnit(unitAt.id); return; }
          // Tap a visible enemy = quick fire preview-commit cycle
          if (unitAt && unitAt.faction === 'enemy') {
            st.setMode('fire');
            st.tryShoot(unitAt.id);
            return;
          }
          // Tap own empty reachable tile = move directly
          if (st.selectedId && st.reach.has(keyOf(g.x, g.y))) st.tryMove(g);
          return;
        }
        if (st.mode === 'move') {
          if (st.reach.has(keyOf(g.x, g.y))) st.tryMove(g);
          else st.setMode('idle');
          return;
        }
        if (st.mode === 'fire') {
          if (unitAt && unitAt.faction === 'enemy') st.tryShoot(unitAt.id);
          else st.setMode('idle');
          return;
        }
        if (st.mode === 'utility' && st.selectedUtilityIdx !== null) {
          st.tryUtility(g, st.selectedUtilityIdx);
          return;
        }
      }

      // ---- Draw loop: re-render unit/overlay layers each tick from store ----
      const unsub = useCombatStore.subscribe(() => {
        redrawOverlays(overlayLayer, useCombatStore.getState());
        redrawUnits(unitLayer, useCombatStore.getState());
      });
      redrawOverlays(overlayLayer, initialState);
      redrawUnits(unitLayer, initialState);

      app.ticker.add(() => {
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
      });

      (app as unknown as { __cleanup?: () => void }).__cleanup = () => {
        unsub();
        app.canvas.removeEventListener('pointerdown', onDown);
        app.canvas.removeEventListener('pointermove', onMove);
        app.canvas.removeEventListener('pointerup', onUp);
        app.canvas.removeEventListener('pointercancel', onUp);
        app.canvas.removeEventListener('wheel', onWheel);
      };
      void lastTap;
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
  const sel = st.units.find((u) => u.id === st.selectedId);
  if (!sel || sel.faction !== 'player' || !sel.alive) return;

  const g = new Graphics();
  if (st.mode === 'move' || st.mode === 'idle') {
    for (const [k, d] of st.reach) {
      const x = k % 4096, y = Math.floor(k / 4096);
      if (x === sel.pos.x && y === sel.pos.y) continue;
      const p = gridToScreen({ x, y });
      const apCost = Math.ceil(d / sel.mobility);
      const color = apCost <= 1 ? 0x7cc4ff : 0xf5c55a;
      diamond(g, p.x, p.y, color, 0.18, color);
    }
  }
  if (st.mode === 'fire') {
    for (const enemy of st.units) {
      if (enemy.faction !== 'enemy' || !enemy.alive) continue;
      if (!hasLineOfSight(st.map, sel.pos, enemy.pos)) continue;
      const p = gridToScreen(enemy.pos);
      diamond(g, p.x, p.y, 0xff5a6a, 0.28, 0xff5a6a);
    }
  }
  if (st.mode === 'utility' && st.selectedUtilityIdx !== null && sel.loadout) {
    const util = sel.loadout.utilityIds[st.selectedUtilityIdx];
    if (util) {
      for (let y = 0; y < st.map.height; y++) {
        for (let x = 0; x < st.map.width; x++) {
          if (chebyshev(sel.pos, { x, y }) > 7) continue;
          const p = gridToScreen({ x, y });
          diamond(g, p.x, p.y, 0xff9a3c, 0.1, 0xff9a3c);
        }
      }
    }
  }
  layer.addChild(g);
}

function redrawUnits(layer: Container, st: ReturnType<typeof useCombatStore.getState>) {
  layer.removeChildren();
  const sorted = [...st.units].sort((a, b) => (a.pos.x + a.pos.y) - (b.pos.x + b.pos.y));
  for (const u of sorted) drawUnit(layer, u, u.id === st.selectedId);
}

function drawUnit(layer: Container, u: Unit, selected: boolean) {
  if (!u.alive) return;
  const p = gridToScreen(u.pos);
  const c = new Container();
  c.position.set(p.x, p.y);

  const shadow = new Graphics();
  shadow.ellipse(0, 6, 14, 6).fill({ color: 0x000000, alpha: 0.5 });
  c.addChild(shadow);

  const body = new Graphics();
  const color = parseInt(u.color.slice(1), 16);
  body.roundRect(-10, -30, 20, 30, 4).fill(color).stroke({ color: 0x0b0f14, width: 1 });
  body.circle(0, -36, 8).fill(color).stroke({ color: 0x0b0f14, width: 1 });
  c.addChild(body);

  if (selected) {
    const ring = new Graphics();
    ring.ellipse(0, 6, 18, 8).stroke({ color: 0x7cc4ff, width: 2 });
    c.addChild(ring);
  }
  if (u.status.overwatch) {
    const ow = new Graphics();
    ow.circle(0, -46, 4).fill(0xf5c55a);
    c.addChild(ow);
  }

  // HP bar
  const bar = new Graphics();
  const pct = u.hp / u.hpMax;
  bar.rect(-14, -48, 28, 4).fill(0x0b0f14);
  bar.rect(-14, -48, 28 * pct, 4).fill(u.faction === 'player' ? 0x57d18b : 0xff5a6a);
  c.addChild(bar);

  const label = new Text({
    text: u.faction === 'player' ? `${u.name} ${u.ap}/${u.apMax}` : u.name,
    style: { fill: 0xaab4c4, fontSize: 10, fontFamily: 'system-ui' },
  });
  label.anchor.set(0.5, 1);
  label.position.set(0, -52);
  c.addChild(label);

  layer.addChild(c);
}

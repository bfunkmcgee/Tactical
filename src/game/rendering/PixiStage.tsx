import { useEffect, useRef } from 'react';
import { Application, Container } from 'pixi.js';
import { useCombatStore } from '../../state/combatStore';
import { useContent } from '../../content/registry';
import { soundEngine, type SoundKey } from '../audio/soundEngine';
import type { UnitId } from '../types';
import { drawMap } from './map/drawMap';
import { redrawOverlays } from './overlays';
import { createFxSystem } from './fx';
import { attachInputController } from './input/controller';
import { handleTap } from './input/handleTap';
import {
  type UnitNode,
  ensureSpritesLoaded,
  syncUnits,
} from './units/UnitNode';
import { applyFireEvents } from './units/fireStyles';
import { tickUnitAnimations } from './units/animate';

/**
 * Thin mount shell for the Pixi stage.
 *
 * Owns:
 *  - the Pixi Application + four layer Containers (tile / overlay / unit / fx)
 *  - the camera (position + zoom + screen shake)
 *  - the per-unit node map that survives across store updates
 *  - wiring between store changes → redraw, ticker → animation tick
 *
 * Each concrete draw / animate / input subsystem lives in its own module
 * under `src/game/rendering/{map,units,input,overlays.ts,fx.ts,context.ts,biomes}/`.
 */
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

      const detachInput = attachInputController({
        canvas: app.canvas, cam, applyCam, onTap: handleTap,
      });

      const fx = createFxSystem(fxLayer);

      let lastPhase = initialState.phase;
      let lastRound = initialState.round;
      const unsub = useCombatStore.subscribe(() => {
        const s = useCombatStore.getState();
        // Phase + round transition stingers. Round-start fires only for
        // rounds ≥ 2 so the initial deploy doesn't blast audio before
        // the screen even settles.
        if (s.phase !== lastPhase) {
          if (s.phase === 'won') soundEngine.play('victory');
          else if (s.phase === 'lost') soundEngine.play('defeat');
          lastPhase = s.phase;
        }
        if (s.round !== lastRound && s.round > 1 && s.phase === 'player') {
          soundEngine.play('round.start');
          lastRound = s.round;
        }
        // Drain floaters from the store into the fx system so ticker
        // animation doesn't churn the store every frame.
        if (s.floaters.length > 0) {
          const now = performance.now();
          for (const f of s.floaters) fx.pushFloater(f.text, f.color, f.pos, now);
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
        if (spritesReady) syncUnits(unitLayer, unitNodes, s, fx.spawnBlood);
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
        tickUnitAnimations(unitLayer, unitNodes, dtMs, now);
        fx.tick(dtMs, now);
      });

      (app as unknown as { __cleanup?: () => void }).__cleanup = () => {
        unsub();
        detachInput();
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

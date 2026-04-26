import { useEffect, useRef } from 'react';
import { Application, Container } from 'pixi.js';
import { useCombatStore } from '../../state/combatStore';
import { useContent } from '../../content/registry';
import { soundEngine, type SoundKey } from '../audio/soundEngine';
import type { UnitId } from '../types';
import { drawMap } from './map/drawMap';
import { redrawOverlays } from './overlays';
import { createFxSystem } from './fx';
import { mountAtmosphere } from './atmosphere';
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
 * Toggle the atmosphere finishing layer (vignette + biome multiply
 * tint + dust motes). Off for the painted-floor mood test — flip
 * back to `true` to restore the post-processed look.
 */
const ATMOSPHERE_ENABLED = false;

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

      // Default camera zoom 1.5x — bumps every game element (tiles,
      // units, props, painted floors) up by 50% on screen. The
      // painted iso floor variants need more pixel real-estate per
      // tile than the procedural look did to read as visibly distinct;
      // 1.5x gives them ~2.25x more pixels each. Players can still
      // pinch out (or wheel-zoom) all the way back to 0.5x for the
      // wide-map view via the input controller.
      const cam = { x: app.screen.width / 2, y: 80, zoom: 1.5 };
      const shakeOffset = { x: 0, y: 0 };
      const applyCam = () => {
        world.position.set(cam.x + shakeOffset.x, cam.y + shakeOffset.y);
        world.scale.set(cam.zoom);
      };

      const initialState = useCombatStore.getState();
      let lastMap = initialState.map;
      drawMap(tileLayer, initialState.map);
      applyCam();

      // Atmosphere finishing layer — vignette + biome tint + dust motes
      // mounted directly on app.stage so the camera doesn't transform
      // them (screen-space ambient effect, not a world overlay). Gated
      // behind ATMOSPHERE_ENABLED so the raw painted-asset look can be
      // tested without post-processing.
      const atmosphere = ATMOSPHERE_ENABLED ? mountAtmosphere(app) : null;
      atmosphere?.setTileset(initialState.map.tileset);

      // Defer unit rendering until sprite preload settles. A pack with a
      // sparse rig/appearance catalog still preloads in a microtask, so
      // the unit layer populates quickly either way.
      // Painted floor tiles also wait on this preload — re-fire drawMap
      // once the textures land so the painted Sprites actually mount.
      // Without this, the initial drawMap call above runs with an empty
      // sprite cache and every floor tile falls through to the
      // procedural fallback (visibly dimmer than painted), and drawMap
      // only re-fires when the map mutation event fires (grenade /
      // demolish) — so painted floors would never appear on most
      // missions.
      let spritesReady = false;
      ensureSpritesLoaded(useContent()).then(() => {
        if (destroyed) return;
        spritesReady = true;
        drawMap(tileLayer, useCombatStore.getState().map);
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
          atmosphere?.setTileset(s.map.tileset);
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
        atmosphere?.tick(dtMs);
      });

      (app as unknown as { __cleanup?: () => void }).__cleanup = () => {
        unsub();
        detachInput();
        atmosphere?.destroy();
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

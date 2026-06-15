import { useEffect, useRef } from 'react';
import { Application, Assets, Container, type Texture } from 'pixi.js';
import { buildHumanRigBody } from '../game/rendering/units/humanRigBody';
import { HUMAN_RIG } from '../content/rigs';
import { spriteCache } from '../game/rendering/context';
import { resolveAssetUrl } from '../game/rendering/assetUrl';
import { useContent, getArmor, getClothing, getKit } from '../content/registry';
import type { HumanAppearance, Loadout } from '../game/types';

const errText = (e: unknown) => (e instanceof Error ? (e.stack ?? e.message) : String(e));

/**
 * Lightweight Pixi canvas that renders a single rig-composed character
 * from a HumanAppearance + optional Loadout. Used by the character
 * creation UI as a live preview pane — picker changes update the
 * `appearance` / `loadout` props and the canvas re-composes.
 *
 * Does NOT go through combatStore / PixiStage — preview state is
 * local to this component. Spawn-time + dev cost is bounded (one
 * Pixi Application per preview + at most a few dozen preloaded
 * overlay textures from the pack).
 */

export interface RigPreviewProps {
  appearance: HumanAppearance;
  loadout?: Loadout;
  /** Canvas size in CSS pixels. Defaults to 180×240. */
  width?: number;
  height?: number;
  /**
   * Camera framing.
   *   - 'full'     — default. Whole figure centered, feet near the bottom.
   *   - 'portrait' — zoomed + translated so the head fills the frame.
   *     Used by SoldierPortrait for richer roster thumbnails.
   */
  framing?: 'full' | 'portrait';
  /** Optional callback with a PNG data URL snapshot after composition. */
  onSnapshot?: (dataUrl: string) => void;
}

export default function RigPreview({
  appearance, loadout, width = 180, height = 240, framing = 'full', onSnapshot,
}: RigPreviewProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  // Refs to the mounted Pixi app + the current rig composition's root.
  // Stored in refs (not state) so we don't re-render React when the
  // preview re-composes internally.
  const appRef = useRef<Application | null>(null);
  const rootRef = useRef<Container | null>(null);
  // Latest props, so the WebGL-context-restore handler can rebuild with the
  // current appearance/loadout rather than the mount-time snapshot.
  const propsRef = useRef({ appearance, loadout });
  propsRef.current = { appearance, loadout };

  // On-screen failure surface (no on-device console on mobile). Only appears
  // on an actual error / context loss.
  const surface = (msg: string) => {
    const host = hostRef.current;
    if (!host) return;
    let el = host.querySelector<HTMLDivElement>('[data-rig-diag]');
    if (!el) {
      el = document.createElement('div');
      el.dataset.rigDiag = '';
      el.style.cssText =
        'position:absolute;left:2px;right:2px;top:2px;z-index:9;' +
        'background:rgba(130,24,24,.92);color:#fff;font:9px/1.3 monospace;' +
        'padding:3px 4px;border-radius:4px;white-space:pre-wrap;pointer-events:none';
      host.appendChild(el);
    }
    el.textContent = msg;
  };
  const clearSurface = () =>
    hostRef.current?.querySelector('[data-rig-diag]')?.remove();

  // Mount once. Preload whatever rig + outfit + hair + armor + clothing
  // URLs the active pack declares so the first render has textures in
  // the cache. This mirrors ensureSpritesLoaded (in UnitNode.ts) but
  // scoped narrower — no unit templates to preload, since the preview
  // composes from the rig alone.
  useEffect(() => {
    const host = hostRef.current!;
    const app = new Application();
    let destroyed = false;

    (async () => {
      await app.init({
        // Force WebGL (see PixiStage) — Pixi v8's WebGPU default renders black
        // on many Android GPUs, which also blanked the roster/header portraits
        // that snapshot through this preview.
        preference: 'webgl',
        width, height,
        background: '#1a1a22',
        antialias: true,
        resolution: Math.min(window.devicePixelRatio, 2),
        autoDensity: true,
      });
      if (destroyed) { app.destroy(true); return; }
      host.appendChild(app.canvas);
      appRef.current = app;

      // Multiple Pixi canvases (this preview, the roster portraits, the combat
      // stage) share GPU contexts; a mobile GPU may drop one. Surface it and
      // rebuild on restore instead of staying black.
      app.canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        surface('preview: WebGL context lost\n(GPU dropped this canvas). restoring…');
      });
      app.canvas.addEventListener('webglcontextrestored', () => {
        const w = app.stage.children[0] as Container | undefined;
        if (w) rebuild(w, propsRef.current.appearance, propsRef.current.loadout);
        clearSurface();
      });

      // Preload all rig-path textures from the active pack. Each file
      // gets cached under the key shape buildHumanRigBody expects
      // (`rig:${rigId}:${partId}` for parts, `overlay:${url}` for
      // hair/outfit/armor/clothing overlays).
      const pack = useContent();
      const loads: Array<Promise<void>> = [];
      const pushLoad = (key: string, url: string | undefined) => {
        if (!url || spriteCache.has(key)) return;
        loads.push((async () => {
          try {
            const tex = await Assets.load<Texture>(resolveAssetUrl(url));
            spriteCache.set(key, tex);
          } catch (err) {
            console.warn(`[rig-preview] failed to load ${key} from ${url}`, err);
          }
        })());
      };
      // Rig parts.
      for (const partId of HUMAN_RIG.parts) {
        const url = {
          'legs':       '/styles/flat/human/human_legs.svg',
          'torso':      '/styles/flat/human/human_torso.svg',
          'arms-back':  '/styles/flat/human/human_arms_back.svg',
          'head':       '/styles/flat/human/human_head.svg',
          'arms-front': '/styles/flat/human/human_arms_front.svg',
        }[partId];
        pushLoad(`rig:${HUMAN_RIG.id}:${partId}`, url);
      }
      // Hair + outfits from the active pack.
      if (pack.hairStyles) {
        for (const h of Object.values(pack.hairStyles)) {
          pushLoad(`overlay:${h.svg}`, h.svg);
        }
      }
      if (pack.baseOutfits) {
        for (const o of Object.values(pack.baseOutfits)) {
          pushLoad(`overlay:${o.torsoSvg}`, o.torsoSvg);
          pushLoad(`overlay:${o.legsSvg}`, o.legsSvg);
        }
      }
      // Armor visual overlays + clothing (so preview can reflect a loadout).
      for (const a of Object.values(pack.armor)) {
        const overlays = a.visual?.overlays;
        if (!overlays) continue;
        for (const layer of Object.values(overlays)) {
          if (layer) pushLoad(`overlay:${layer.svg}`, layer.svg);
        }
      }
      if (pack.clothing) {
        for (const c of Object.values(pack.clothing)) {
          pushLoad(`overlay:${c.svg}`, c.svg);
        }
      }
      await Promise.all(loads);
      if (destroyed) return;

      // Center the rig in the canvas. The rig's foot origin sits at
      // the world Container's (0, 4); the head joint sits at
      // (0, -44.5 * scale). `framing` decides whether we frame the
      // whole figure or zoom in on the head.
      const world = new Container();
      applyFraming(world, framing, width, height);
      app.stage.addChild(world);
      rebuild(world, appearance, loadout);
      if (onSnapshot) {
        requestAnimationFrame(() => {
          try { onSnapshot(app.canvas.toDataURL('image/png')); } catch { /* ignore snapshot failures */ }
        });
      }
    })();

    return () => {
      destroyed = true;
      try { app.destroy(true); } catch { /* ignore destroy errors */ }
      appRef.current = null;
      rootRef.current = null;
    };
    // Mount-once — width/height are effectively constants for a given
    // preview instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-compose whenever appearance or loadout changes.
  useEffect(() => {
    const app = appRef.current;
    if (!app) return;
    const world = app.stage.children[0] as Container | undefined;
    if (!world) return;
    rebuild(world, appearance, loadout);
    if (onSnapshot) {
      requestAnimationFrame(() => {
        try { onSnapshot(app.canvas.toDataURL('image/png')); } catch { /* ignore snapshot failures */ }
      });
    }
  }, [appearance, loadout, onSnapshot]);

  // Re-frame when the framing prop flips between 'full' and 'portrait'.
  useEffect(() => {
    const app = appRef.current;
    if (!app) return;
    const world = app.stage.children[0] as Container | undefined;
    if (!world) return;
    applyFraming(world, framing, width, height);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [framing, width, height]);

  /**
   * Place + scale the world Container so the rig is framed as requested.
   * Values derived from SPRITE_SCALE = 0.42 in humanRigBody.ts — the
   * rig's bounding box at scale 1 spans roughly y = -49.76 (head top)
   * to y = 4 (foot), height ≈ 54 px; width ≈ 40 px. 'full' fits the
   * figure to ~85% of the available canvas dimension so the preview
   * actually reads as a character; 'portrait' zooms further in on
   * the head joint.
   */
  function applyFraming(world: Container, mode: 'full' | 'portrait',
    w: number, h: number): void {
    if (mode === 'portrait') {
      const headY = -44.5; // head joint offset from world origin at scale 1
      const scale = 2.4;
      world.scale.set(scale);
      world.position.set(w / 2, h / 2 - headY * scale);
    } else {
      // RIG_W ≈ 40, RIG_H ≈ 54 at scale 1. Fit to 85% of the smaller
      // dimension; clamp to a reasonable minimum so the figure stays
      // legible even in cramped panes.
      const scale = Math.max(2, Math.min(w / 40, h / 54) * 0.85);
      world.scale.set(scale);
      // Place feet ~12% above the bottom so the figure has air below
      // and the head clears the top with margin.
      world.position.set(w / 2, h * 0.88 - 4 * scale);
    }
  }

  function rebuild(world: Container, appr: HumanAppearance, ld: Loadout | undefined): void {
    // Build the NEW composition first. Only once it succeeds do we tear down
    // and swap out the old one — so a failed build can't leave the canvas
    // black (the previous composition stays on screen instead), and the
    // `destroy({ children: true })` only releases sprites, never the shared
    // spriteCache textures (texture defaults to false in Pixi v8).
    let comp: ReturnType<typeof buildHumanRigBody>;
    try {
      comp = buildHumanRigBody(HUMAN_RIG, appr, ld, spriteCache, {
        armorOf: (id) => { try { return getArmor(id); } catch { return undefined; } },
        clothingOf: getClothing,
        hairStyleOf: (id) => useContent().hairStyles?.[id],
        baseOutfitOf: (id) => useContent().baseOutfits?.[id],
        kitOf: (id) => { try { return getKit(id); } catch { return undefined; } },
      });
    } catch (err) {
      surface('Preview build failed:\n' + errText(err));
      return; // keep the previous composition visible
    }
    const prev = rootRef.current;
    world.addChild(comp.root);
    rootRef.current = comp.root;
    if (prev) {
      world.removeChild(prev);
      prev.destroy({ children: true });
    }
    clearSurface();
  }

  return (
    <div
      ref={hostRef}
      style={{
        position: 'relative',
        width, height,
        border: '1px solid var(--bg-3)',
        borderRadius: 'var(--r-md)',
        overflow: 'hidden',
        background: '#1a1a22',
      }}
    />
  );
}

import { useEffect, useRef } from 'react';
import { Application, Assets, Container, type Texture } from 'pixi.js';
import { buildHumanRigBody } from '../game/rendering/units/humanRigBody';
import { HUMAN_RIG } from '../content/rigs';
import { spriteCache } from '../game/rendering/context';
import { useContent, getArmor, getClothing } from '../content/registry';
import type { HumanAppearance, Loadout } from '../game/types';

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
}

export default function RigPreview({
  appearance, loadout, width = 180, height = 240,
}: RigPreviewProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  // Refs to the mounted Pixi app + the current rig composition's root.
  // Stored in refs (not state) so we don't re-render React when the
  // preview re-composes internally.
  const appRef = useRef<Application | null>(null);
  const rootRef = useRef<Container | null>(null);

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
        width, height,
        background: '#1a1a22',
        antialias: true,
        resolution: Math.min(window.devicePixelRatio, 2),
        autoDensity: true,
      });
      if (destroyed) { app.destroy(true); return; }
      host.appendChild(app.canvas);
      appRef.current = app;

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
            const tex = await Assets.load<Texture>(url);
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
        const v = a.visual;
        if (!v) continue;
        const overlay = (u?: string) => u && pushLoad(`overlay:${u}`, u);
        overlay(v.torsoOverlay); overlay(v.helmet); overlay(v.shoulderPads);
        overlay(v.gauntletsFront); overlay(v.gauntletsBack); overlay(v.legsOverlay);
      }
      if (pack.clothing) {
        for (const c of Object.values(pack.clothing)) {
          pushLoad(`overlay:${c.svg}`, c.svg);
        }
      }
      await Promise.all(loads);
      if (destroyed) return;

      // Center the rig in the canvas. The rig's foot origin sits at
      // the Container's (0, 4) — push the world container down by ~80%
      // of canvas height so the feet land toward the bottom of the frame.
      const world = new Container();
      world.position.set(width / 2, height * 0.88);
      app.stage.addChild(world);
      rebuild(world, appearance, loadout);
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
  }, [appearance, loadout]);

  function rebuild(world: Container, appr: HumanAppearance, ld: Loadout | undefined): void {
    // Tear down the previous composition.
    if (rootRef.current) {
      world.removeChild(rootRef.current);
      rootRef.current.destroy({ children: true });
      rootRef.current = null;
    }
    const comp = buildHumanRigBody(HUMAN_RIG, appr, ld, spriteCache, {
      armorOf: (id) => { try { return getArmor(id); } catch { return undefined; } },
      clothingOf: getClothing,
      hairStyleOf: (id) => useContent().hairStyles?.[id],
      baseOutfitOf: (id) => useContent().baseOutfits?.[id],
    });
    world.addChild(comp.root);
    rootRef.current = comp.root;
  }

  return (
    <div
      ref={hostRef}
      style={{
        width, height,
        border: '1px solid var(--bg-3)',
        borderRadius: 'var(--r-md)',
        overflow: 'hidden',
        background: '#1a1a22',
      }}
    />
  );
}

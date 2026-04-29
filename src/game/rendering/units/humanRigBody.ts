import { Container, Sprite, type Texture } from 'pixi.js';
import type { Rig, RigPartId } from '../../engine/rig';
import type { Armor, Clothing, HumanAppearance, Kit, Loadout } from '../../types';
import { GRIP_ANCHOR } from './constants';

/**
 * Rigged body composition — the return value of `buildHumanRigBody`.
 *
 * `root` is attached into `UnitNode.body` at the same local position the
 * legacy monolithic sprite sat, so shadow + selection ring + HP bar +
 * label continue to anchor correctly without knowing which composition
 * path built the unit.
 *
 * The named sub-containers (`headSlot` / `shoulderSlotL` / `shoulderSlotR`
 * / `backSlot`) are populated by the overlay pass when the unit's
 * loadout carries armor (`armor.visual.*`) or clothing.
 *
 * `armsFront` is returned separately from `parts` because the caller
 * (createUnitNode) installs it inside the weapon wrap, not under `root`
 * — the front arm must ride with the weapon grip for aim + recoil.
 */
export interface RigBodyComposition {
  /** Root Container for body-bound parts (legs/torso/arms-back/head). */
  root: Container;
  /** Every named part sprite — Phase 4 animation addresses these by id. */
  parts: Record<RigPartId, Sprite>;
  /** The arms-front Sprite, NOT parented into `root`. The caller should
   *  install it inside the weapon wrap so it rides with the grip. */
  armsFront: Sprite;
  /** Named attachment slots for equipment overlays. */
  headSlot: Container;
  shoulderSlotL: Container;
  shoulderSlotR: Container;
  backSlot: Container;
  /** Belt / waist-mounted overlays (kit pouches, grenades). Introduced
   *  in Phase 6d; previously piggybacked on backSlot. */
  waistSlot: Container;
  /** All sprites that should receive the per-frame tint (dirt / hit-flash
   *  / death). animate.ts walks this list for rig-composed units. */
  tintTargets: Sprite[];
  /** Initial local (x, y) every base part sprite was placed at inside
   *  `root`. animate.ts adds walk-cycle / recoil deltas on top of this
   *  baseline rather than overwriting — overwriting would shift the
   *  driven sprite (currently torso) out of stack with the others
   *  (legs/head/arms-back), which stay put at this offset. */
  basePartPos: { x: number; y: number };
  /** Initial uniform scale every base part sprite was placed at inside
   *  `root` (the rig's 96×128 → on-screen ratio). animate.ts multiplies
   *  walk-cycle squash deltas on top of this rather than overwriting —
   *  overwriting would scale the part to a different absolute size and
   *  push its drawn content out of the unit's tile. */
  baseScale: number;
  wearOverlays: Partial<Record<'scratch' | 'tear' | 'scorch', Sprite>>;
}

/** Lookup callbacks the composition needs — threaded from the store/pack. */
export interface RigBodyDeps {
  armorOf: (id: string) => Armor | undefined;
  clothingOf: (id: string) => Clothing | undefined;
  /** Hair-style catalog entry by id. Returns undefined for packs without
   *  hair catalogs or for an unknown style id. */
  hairStyleOf?: (id: string) => { svg: string } | undefined;
  /** Base-outfit catalog entry by id. Drives the torso/legs look when no
   *  armor overlay covers them. */
  baseOutfitOf?: (id: string) => { torsoSvg: string; legsSvg: string } | undefined;
  /** Kit lookup. When set on a Loadout and the kit carries a `visual`,
   *  its overlays composite onto the rig after the armor pass
   *  (belt pouches, boots, backpack, etc.). Unknown ids are ignored. */
  kitOf?: (id: string) => Kit | undefined;
  wearDecals?: Partial<Record<'scratch' | 'tear' | 'scorch', string>>;
}

/**
 * Sprite scale shared with the legacy bespoke path. Matches the 96×128
 * viewBox → on-screen conversion used for every existing soldier/enemy
 * sprite — the rig's joint offsets land at the same screen coordinates
 * the old monolithic sprites used.
 */
const SPRITE_SCALE = 0.42;

/**
 * Phase 6d z-bucket vocabulary. Root's children sort by these values so
 * draw order is declarative. Base parts sit in 10–40; the 'torso'
 * overlay jumps to 45 (above the base head at 40) so armor covers any
 * face paint bleeding through the rig-head — replaces the pre-6d
 * "insert after 'head'" insertion-order hack.
 */
const Z_BASE_PART: Record<RigPartId, number> = {
  legs: 10,
  'arms-back': 20,
  torso: 30,
  head: 40,
  'arms-front': 90, // lives in weaponWrap, not root; kept for completeness
};
/** Body-aligned overlay zIndex per BodySlot target. Not every BodySlot
 *  lands here — slot-mounted ones (helmet, shoulders, etc.) render
 *  inside their dedicated Container. */
const Z_BODY_OVERLAY: Partial<Record<'legs' | 'torso' | 'gauntlet-back', number>> = {
  legs: 12,
  'gauntlet-back': 22,
  torso: 45,
};
/** Slot containers — each gets a zIndex so the sort pass puts them in
 *  the right stack relative to base parts. */
const Z_SLOT = {
  back:      15, // behind torso, above legs (cloaks, backpacks)
  waist:     22, // above arms-back, below torso (belt pouches, grenades)
  head:      50, // above base head (hair + helmet layer)
  shoulder:  55, // above head so shoulder pads don't hide behind face
} as const;

/**
 * Build a rigged body tree + composite armor / clothing overlays.
 *
 * Composition order (bottom → top):
 *   base parts per rig.parts                (legs → torso → arms-back → head)
 *   + backSlot (between legs and torso)     — clothing.layer='cloak' + 'backpack'
 *   + torsoOverlay (on torso)               — armor.visual.torsoOverlay
 *   + tabard clothing (after torsoOverlay)  — clothing.layer='tabard'
 *   + legsOverlay (on legs)                 — armor.visual.legsOverlay
 *   + gauntletsBack (on arms-back)          — armor.visual.gauntletsBack
 *   + shoulderPads (L mirrored, R normal)   — armor.visual.shoulderPads
 *   + helmet (over head)                    — armor.visual.helmet
 *   + gauntletsFront (on arms-front)        — armor.visual.gauntletsFront
 *
 * Phase 2 applied skinTone as a whole-sprite tint on head + arms. Overlay
 * SVGs authored by pack content are NOT skin-tinted (they're cloth/metal),
 * but may carry their own `armor.visual.tint` / `clothing.tint` multiplicative
 * colour — applied on top of the 0xffffff base.
 */
export function buildHumanRigBody(
  rig: Rig,
  appearance: HumanAppearance,
  loadout: Loadout | undefined,
  cache: Map<string, Texture>,
  deps: RigBodyDeps,
): RigBodyComposition {
  const root = new Container();
  const tintTargets: Sprite[] = [];
  const wearOverlays: Partial<Record<'scratch' | 'tear' | 'scorch', Sprite>> = {};

  // Screen origin (0, 0) in UnitNode.body == the ground beneath the
  // unit. Part sprites are anchored at (0, 0) with positions computed
  // from rig.viewBox → local so the stacked feet land at y=4 (matches
  // the existing bespoke sprite.position.set(0, 4)).
  const footOffsetY = 4;
  const scaledH = rig.viewBox.h * SPRITE_SCALE;
  const partTopY = footOffsetY - scaledH;
  const partLeftX = -(rig.viewBox.w * SPRITE_SCALE) / 2;

  // Phase 6d — explicit z-buckets replace the old insertion-order hacks.
  // Every renderable gets a zIndex; sortableChildren on root enforces
  // the order regardless of addChild sequence. Keeps the "torso overlay
  // above base head" rule declarative instead of a comment in the
  // dispatcher.
  root.sortableChildren = true;

  // Instantiate each base part in the rig's draw order. Per-soldier
  // `appearance.partOverrides` can substitute a custom SVG for any
  // individual part — the renderer prefers the override URL (cached
  // under `overlay:${url}`) when present, falling back to the shared
  // rig part (`rig:${rigId}:${partId}`) when not.
  const parts: Partial<Record<RigPartId, Sprite>> = {};
  // Track parts that carry a baked-art partOverride so the skin-mask
  // pass (below) knows which ones may have a companion skin-texture.
  const overrideParts: Array<{ partId: RigPartId; url: string }> = [];
  for (const partId of rig.parts) {
    const overrideUrl = appearance.partOverrides?.[partId];
    const tex = overrideUrl
      ? cache.get(`overlay:${overrideUrl}`) ?? cache.get(`rig:${rig.id}:${partId}`)
      : cache.get(`rig:${rig.id}:${partId}`);
    const sprite = new Sprite(tex);
    sprite.anchor.set(0, 0);
    sprite.scale.set(SPRITE_SCALE);
    sprite.position.set(partLeftX, partTopY);
    sprite.zIndex = Z_BASE_PART[partId];
    parts[partId] = sprite;
    tintTargets.push(sprite);
    if (partId !== 'arms-front') root.addChild(sprite);
    if (overrideUrl) overrideParts.push({ partId, url: overrideUrl });
  }

  // Skin-mask pass. For each part whose override SVG opted in via
  // `class="skin"` on the exposed-skin paths, the preloader cached a
  // skin-only variant under `overlay:${url}:skin`. We mount it as a
  // companion sprite at the same position + slightly-higher zIndex,
  // tinted with appearance.skinTone — overwrites the base skin pixels
  // with the recolored result without double-tinting non-skin pixels.
  // Missing skin texture = graceful skip (the common case).
  for (const { partId, url } of overrideParts) {
    const skinTex = cache.get(skinMaskCacheKey(url));
    if (!skinTex) continue;
    const s = new Sprite(skinTex);
    s.tint = appearance.skinTone;
    if (partId === 'arms-front') {
      // arms-front is re-parented into weaponWrap by the caller and
      // has its anchor reset to GRIP_ANCHOR there. Mirror that anchor
      // on the child so the child's texture anchor point coincides
      // with the parent's — otherwise Pixi's per-sprite anchor leaves
      // this child at parent-local (0, 0) and the visible texture
      // shifts by (GRIP_ANCHOR.x * texW, GRIP_ANCHOR.y * texH) in
      // parent local space (~one iso tile SE) once the parent's
      // anchor is mutated after child attach.
      s.anchor.set(GRIP_ANCHOR.x, GRIP_ANCHOR.y);
      s.scale.set(1);
      s.position.set(0, 0);
      parts['arms-front']!.addChild(s);
    } else {
      s.anchor.set(0, 0);
      s.scale.set(SPRITE_SCALE);
      s.position.set(partLeftX, partTopY);
      // +0.5 sits the skin layer immediately above its base part,
      // below any overlay that targets a higher slot.
      s.zIndex = Z_BASE_PART[partId] + 0.5;
      root.addChild(s);
    }
    tintTargets.push(s);
  }

  // Skin tint applies only to shared-rig parts. When a soldier ships
  // their own authored part SVG via partOverrides, the skin tone is
  // baked in — multiplying it with a whole-sprite tint would double-
  // darken the authored colour. Override parts stay at identity tint.
  if (!appearance.partOverrides?.head) applyPartTint(parts, 'head', appearance.skinTone);
  if (!appearance.partOverrides?.['arms-back']) applyPartTint(parts, 'arms-back', appearance.skinTone);
  if (!appearance.partOverrides?.['arms-front']) applyPartTint(parts, 'arms-front', appearance.skinTone);

  // Attachment slots. Positioning follows joint anchors scaled into local
  // coords; z-order is now enforced by the Z_SLOT bucket table (Phase
  // 6d) rather than insertion order.
  const backSlot = new Container();
  const waistSlot = new Container();
  const shoulderSlotL = new Container();
  const shoulderSlotR = new Container();
  const headSlot = new Container();

  backSlot.position.set(
    partLeftX + rig.joints['neck'].offset.x * SPRITE_SCALE,
    partTopY + rig.joints['neck'].offset.y * SPRITE_SCALE,
  );
  backSlot.zIndex = Z_SLOT.back;
  root.addChild(backSlot);

  // Waist slot for belt-mounted overlays (kit pouches, grenades).
  // Positioned at the waist joint; dedicated anchor supersedes the
  // pre-6d hack of piggybacking 'belt' onto backSlot.
  waistSlot.position.set(
    partLeftX + rig.joints['waist'].offset.x * SPRITE_SCALE,
    partTopY + rig.joints['waist'].offset.y * SPRITE_SCALE,
  );
  waistSlot.zIndex = Z_SLOT.waist;
  root.addChild(waistSlot);

  shoulderSlotL.position.set(
    partLeftX + rig.joints['shoulder-l'].offset.x * SPRITE_SCALE,
    partTopY + rig.joints['shoulder-l'].offset.y * SPRITE_SCALE,
  );
  shoulderSlotL.zIndex = Z_SLOT.shoulder;
  shoulderSlotR.position.set(
    partLeftX + rig.joints['shoulder-r'].offset.x * SPRITE_SCALE,
    partTopY + rig.joints['shoulder-r'].offset.y * SPRITE_SCALE,
  );
  shoulderSlotR.zIndex = Z_SLOT.shoulder;
  root.addChild(shoulderSlotL, shoulderSlotR);

  headSlot.position.set(
    partLeftX + rig.joints['head'].offset.x * SPRITE_SCALE,
    partTopY + rig.joints['head'].offset.y * SPRITE_SCALE,
  );
  headSlot.zIndex = Z_SLOT.head;
  root.addChild(headSlot);

  // ---- Overlay pass: armor + clothing ----
  //
  // Phase 3's first user-visible win. Overlays are authored as part-aligned
  // SVGs in the same viewBox as the base parts, so positioning is a
  // straightforward copy of the base-part transform for body-aligned
  // overlays, or a slot position for anchor-mounted pieces.

  /**
   * Add a body-aligned overlay sprite in the 96x128 rig frame. zIndex
   * comes from the Z_BODY_OVERLAY table keyed on BodySlot — 'torso'
   * lands above the base head so armor covers any painted face on the
   * rig-head; 'legs' / 'gauntlet-back' sit just above their base part.
   */
  const addBodyAlignedOverlay = (url: string, tint: number | undefined,
    bodySlot: 'legs' | 'torso' | 'gauntlet-back') => {
    const tex = cache.get(`overlay:${url}`);
    if (!tex) return null;
    const s = new Sprite(tex);
    s.anchor.set(0, 0);
    s.scale.set(SPRITE_SCALE);
    s.position.set(partLeftX, partTopY);
    s.zIndex = Z_BODY_OVERLAY[bodySlot] ?? 0;
    if (tint !== undefined) s.tint = tint;
    root.addChild(s);
    tintTargets.push(s);
    return s;
  };

  const addSlotOverlay = (slot: Container, url: string, tint: number | undefined, mirror = false) => {
    const tex = cache.get(`overlay:${url}`);
    if (!tex) return null;
    const s = new Sprite(tex);
    // Slot-mounted overlays anchor at center so the joint sits at the
    // slot's origin. Author convention: draw centered on the joint.
    s.anchor.set(0.5, 0.5);
    s.scale.set(mirror ? -SPRITE_SCALE : SPRITE_SCALE, SPRITE_SCALE);
    if (tint !== undefined) s.tint = tint;
    slot.addChild(s);
    tintTargets.push(s);
    return s;
  };
  const addWearOverlay = (kind: 'scratch' | 'tear' | 'scorch', url: string) => {
    const tex = cache.get(`overlay:${url}`);
    if (!tex) return;
    const s = new Sprite(tex);
    s.anchor.set(0, 0);
    s.scale.set(SPRITE_SCALE);
    s.position.set(partLeftX, partTopY);
    s.alpha = 0;
    s.zIndex = kind === 'scorch' ? 48 : 46;
    root.addChild(s);
    tintTargets.push(s);
    wearOverlays[kind] = s;
  };

  // ---- Base outfit pass: civvies on top of the base torso + legs,
  // underneath any armor. Drawn even when no loadout is set so a rig
  // preview (e.g. character creation UI with no equipment picked yet)
  // still has clothing. Un-tinted — the outfit SVG carries its own
  // authored colors.
  const baseOutfit = appearance.baseOutfit
    ? deps.baseOutfitOf?.(appearance.baseOutfit)
    : undefined;
  if (baseOutfit) {
    addBodyAlignedOverlay(baseOutfit.torsoSvg, undefined, 'torso');
    addBodyAlignedOverlay(baseOutfit.legsSvg, undefined, 'legs');
  }

  // ---- Hair pass: slot-mounted in headSlot at the head joint. Helmets
  // (if any) land later in the armor pass and cover hair. Tint applies
  // appearance.hairColor so one hair-style SVG recolours across the
  // HAIR_COLORS palette.
  const hairStyle = appearance.hairStyle
    ? deps.hairStyleOf?.(appearance.hairStyle)
    : undefined;
  if (hairStyle) {
    const hairTex = cache.get(`overlay:${hairStyle.svg}`);
    if (hairTex) {
      const h = new Sprite(hairTex);
      h.anchor.set(0.5, 0.5);
      h.scale.set(SPRITE_SCALE);
      if (appearance.hairColor !== undefined) h.tint = appearance.hairColor;
      headSlot.addChild(h);
      tintTargets.push(h);
    }
  }

  /**
   * Route each BodySlot entry in a Visual.overlays map to the right host
   * (body-aligned part, slot-mounted Container, or arms-front child).
   * Shared between the armor pass and the kit pass; weapon-* slots are
   * no-op here and get consumed by the weapon renderer in UnitNode.
   */
  const applyOverlays = (overlays: NonNullable<Armor['visual']>['overlays']): void => {
    if (!overlays) return;
    for (const [bodySlot, layer] of Object.entries(overlays)) {
      if (!layer) continue;
      switch (bodySlot) {
        case 'torso':
          // zIndex 45 (Z_BODY_OVERLAY.torso) places the overlay above
          // the base head (zIndex 40) so armor covers any painted face
          // on the rig-head. Replaces the pre-6d insertion-order hack.
          addBodyAlignedOverlay(layer.svg, layer.tint, 'torso');
          break;
        case 'legs':
          addBodyAlignedOverlay(layer.svg, layer.tint, 'legs');
          break;
        case 'gauntlet-back':
          addBodyAlignedOverlay(layer.svg, layer.tint, 'gauntlet-back');
          break;
        case 'helmet':
          addSlotOverlay(headSlot, layer.svg, layer.tint);
          break;
        case 'shoulder-l':
          addSlotOverlay(shoulderSlotL, layer.svg, layer.tint);
          break;
        case 'shoulder-r':
          addSlotOverlay(shoulderSlotR, layer.svg, layer.tint, true);
          break;
        case 'gauntlet-front': {
          // gauntlet-front composites onto the arms-front sprite, which
          // lives inside the weapon wrap (set up by the caller). The
          // caller mutates arms-front's anchor to GRIP_ANCHOR after we
          // return, so mirror that anchor here — otherwise the gauntlet
          // texture renders at parent-local (0, 0) and shifts ~one iso
          // tile SE of the hand once the parent is re-anchored.
          const frontSprite = parts['arms-front'];
          if (!frontSprite) break;
          const tex = cache.get(`overlay:${layer.svg}`);
          if (!tex) break;
          const s = new Sprite(tex);
          s.anchor.set(GRIP_ANCHOR.x, GRIP_ANCHOR.y);
          s.scale.set(1);
          s.position.set(0, 0);
          if (layer.tint !== undefined) s.tint = layer.tint;
          frontSprite.addChild(s);
          tintTargets.push(s);
          break;
        }
        case 'back':
          addSlotOverlay(backSlot, layer.svg, layer.tint);
          break;
        case 'belt':
          addSlotOverlay(waistSlot, layer.svg, layer.tint);
          break;
        // boot-l, boot-r, face, weapon-* — no dedicated slot yet;
        // consumed by future phases or the weapon renderer.
      }
    }
  };

  if (loadout) {
    // Armor pieces — each one may contribute overlays to any BodySlot.
    for (const armorId of Object.values(loadout.armor)) {
      if (!armorId) continue;
      applyOverlays(deps.armorOf(armorId)?.visual?.overlays);
    }

    // Kit — single optional overlay set. Typically belt pouches / boots
    // / backpack; a kit with no visual is stat-only (invisible).
    if (loadout.kitId && deps.kitOf) {
      applyOverlays(deps.kitOf(loadout.kitId)?.visual?.overlays);
    }

    // Clothing layers, in loadout order. Order matters — a tabard worn
    // over a cloak sits on top of the cloak because we append sequentially.
    for (const clothId of loadout.clothingIds ?? []) {
      const cloth = deps.clothingOf(clothId);
      if (!cloth) continue;
      if (cloth.layer === 'cloak' || cloth.layer === 'backpack') {
        addSlotOverlay(backSlot, cloth.svg, cloth.tint);
      } else {
        // Tabard — body-aligned overlay on top of the torso + torsoOverlay.
        addBodyAlignedOverlay(cloth.svg, cloth.tint, 'torso');
      }
    }
  }
  if (deps.wearDecals?.scratch) addWearOverlay('scratch', deps.wearDecals.scratch);
  if (deps.wearDecals?.tear) addWearOverlay('tear', deps.wearDecals.tear);
  if (deps.wearDecals?.scorch) addWearOverlay('scorch', deps.wearDecals.scorch);

  return {
    root,
    parts: parts as Record<RigPartId, Sprite>,
    armsFront: parts['arms-front']!,
    headSlot,
    shoulderSlotL,
    shoulderSlotR,
    backSlot,
    waistSlot,
    tintTargets,
    basePartPos: { x: partLeftX, y: partTopY },
    baseScale: SPRITE_SCALE,
    wearOverlays,
  };
}

function applyPartTint(parts: Partial<Record<RigPartId, Sprite>>, id: RigPartId, tint: number): void {
  const s = parts[id];
  if (s) s.tint = tint;
}

/** URL keys armor + clothing overlays are cached under. Preloader uses
 *  the same prefix so buildHumanRigBody's cache lookups find them. */
export function overlayCacheKey(url: string): string {
  return `overlay:${url}`;
}

/**
 * Skin-mask texture cache key. When a partOverride SVG opts in via
 * `class="skin"` on its skin paths, the preloader extracts a skin-only
 * variant + caches the derived texture under this key. The renderer
 * mounts it as a tinted sprite on top of the base part so hero art
 * can recolor by skinTone without double-tinting the non-skin pixels.
 */
export function skinMaskCacheKey(url: string): string {
  return `overlay:${url}:skin`;
}

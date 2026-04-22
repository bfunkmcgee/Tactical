import { Container, Sprite, type Texture } from 'pixi.js';
import type { Rig, RigPartId } from '../../engine/rig';
import type { Armor, Clothing, HumanAppearance, Loadout } from '../../types';

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
  /** All sprites that should receive the per-frame tint (dirt / hit-flash
   *  / death). animate.ts walks this list for rig-composed units. */
  tintTargets: Sprite[];
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
}

/**
 * Sprite scale shared with the legacy bespoke path. Matches the 96×128
 * viewBox → on-screen conversion used for every existing soldier/enemy
 * sprite — the rig's joint offsets land at the same screen coordinates
 * the old monolithic sprites used.
 */
const SPRITE_SCALE = 0.42;

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

  // Screen origin (0, 0) in UnitNode.body == the ground beneath the
  // unit. Part sprites are anchored at (0, 0) with positions computed
  // from rig.viewBox → local so the stacked feet land at y=4 (matches
  // the existing bespoke sprite.position.set(0, 4)).
  const footOffsetY = 4;
  const scaledH = rig.viewBox.h * SPRITE_SCALE;
  const partTopY = footOffsetY - scaledH;
  const partLeftX = -(rig.viewBox.w * SPRITE_SCALE) / 2;

  // Instantiate each base part in the rig's draw order.
  const parts: Partial<Record<RigPartId, Sprite>> = {};
  for (const partId of rig.parts) {
    const sprite = new Sprite(cache.get(`rig:${rig.id}:${partId}`));
    sprite.anchor.set(0, 0);
    sprite.scale.set(SPRITE_SCALE);
    sprite.position.set(partLeftX, partTopY);
    parts[partId] = sprite;
    tintTargets.push(sprite);
    if (partId !== 'arms-front') root.addChild(sprite);
  }

  applyPartTint(parts, 'head', appearance.skinTone);
  applyPartTint(parts, 'arms-back', appearance.skinTone);
  applyPartTint(parts, 'arms-front', appearance.skinTone);

  // Attachment slots. Positioning follows joint anchors scaled into local
  // coords; z-order is enforced by insertion order relative to the base
  // parts.
  const backSlot = new Container();
  const shoulderSlotL = new Container();
  const shoulderSlotR = new Container();
  const headSlot = new Container();

  // backSlot between legs and torso so cloaks drape from the neck behind
  // the body but in front of the legs.
  const legsIndex = root.children.indexOf(parts.legs!);
  root.addChildAt(backSlot, legsIndex + 1);
  backSlot.position.set(
    partLeftX + rig.joints['neck'].offset.x * SPRITE_SCALE,
    partTopY + rig.joints['neck'].offset.y * SPRITE_SCALE,
  );

  shoulderSlotL.position.set(
    partLeftX + rig.joints['shoulder-l'].offset.x * SPRITE_SCALE,
    partTopY + rig.joints['shoulder-l'].offset.y * SPRITE_SCALE,
  );
  shoulderSlotR.position.set(
    partLeftX + rig.joints['shoulder-r'].offset.x * SPRITE_SCALE,
    partTopY + rig.joints['shoulder-r'].offset.y * SPRITE_SCALE,
  );
  root.addChild(shoulderSlotL, shoulderSlotR);

  headSlot.position.set(
    partLeftX + rig.joints['head'].offset.x * SPRITE_SCALE,
    partTopY + rig.joints['head'].offset.y * SPRITE_SCALE,
  );
  const headIndex = root.children.indexOf(parts.head!);
  root.addChildAt(headSlot, headIndex + 1);

  // ---- Overlay pass: armor + clothing ----
  //
  // Phase 3's first user-visible win. Overlays are authored as part-aligned
  // SVGs in the same viewBox as the base parts, so positioning is a
  // straightforward copy of the base-part transform for body-aligned
  // overlays, or a slot position for anchor-mounted pieces.

  const addBodyAlignedOverlay = (url: string, tint: number | undefined, afterPart: RigPartId) => {
    const tex = cache.get(`overlay:${url}`);
    if (!tex) return null;
    const s = new Sprite(tex);
    s.anchor.set(0, 0);
    s.scale.set(SPRITE_SCALE);
    s.position.set(partLeftX, partTopY);
    if (tint !== undefined) s.tint = tint;
    // Insert immediately after the named base part (e.g. torsoOverlay
    // after torso, legsOverlay after legs).
    const baseIdx = root.children.indexOf(parts[afterPart]!);
    if (baseIdx >= 0) root.addChildAt(s, baseIdx + 1);
    else root.addChild(s);
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
      h.tint = appearance.hairColor;
      headSlot.addChild(h);
      tintTargets.push(h);
    }
  }

  if (loadout) {
    const armor = deps.armorOf(loadout.armorId);
    const vis = armor?.visual;
    if (vis) {
      // torsoOverlay inserts AFTER 'head' rather than after 'torso' so the
      // overlay draws on top of the base torso + base head. This matters
      // because rig part SVGs (especially placeholder art) render a face
      // on the head part — inserting after 'torso' would leave that face
      // painted on top of the armor. Real torso-only armor SVGs can carry
      // transparent pixels at the head region; authored-correctly art
      // still shows the rig head underneath. Full-body armor overlays
      // (like the current bespoke-reuse in 5b) are opaque at the head
      // region and fully occlude the placeholder face.
      if (vis.torsoOverlay) addBodyAlignedOverlay(vis.torsoOverlay, vis.tint, 'head');
      if (vis.legsOverlay) addBodyAlignedOverlay(vis.legsOverlay, vis.tint, 'legs');
      if (vis.gauntletsBack) addBodyAlignedOverlay(vis.gauntletsBack, vis.tint, 'arms-back');
      if (vis.helmet) addSlotOverlay(headSlot, vis.helmet, vis.tint);
      if (vis.shoulderPads) {
        addSlotOverlay(shoulderSlotL, vis.shoulderPads, vis.tint);
        addSlotOverlay(shoulderSlotR, vis.shoulderPads, vis.tint, true);
      }
      // gauntletsFront composites onto the arms-front sprite — but
      // arms-front lives inside the weapon wrap (set up by the caller).
      // We don't have the weapon wrap here; instead, stash the gauntlet
      // sprite as a child of arms-front itself via a local position.
      if (vis.gauntletsFront && parts['arms-front']) {
        const tex = cache.get(`overlay:${vis.gauntletsFront}`);
        if (tex) {
          const s = new Sprite(tex);
          s.anchor.set(0, 0);
          s.scale.set(1);
          s.position.set(0, 0);
          if (vis.tint !== undefined) s.tint = vis.tint;
          parts['arms-front'].addChild(s);
          tintTargets.push(s);
        }
      }
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

  return {
    root,
    parts: parts as Record<RigPartId, Sprite>,
    armsFront: parts['arms-front']!,
    headSlot,
    shoulderSlotL,
    shoulderSlotR,
    backSlot,
    tintTargets,
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

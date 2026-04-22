import { Container, Sprite, type Texture } from 'pixi.js';
import type { Rig, RigPartId } from '../../engine/rig';
import type { HumanAppearance } from '../../types';

/**
 * Rigged body composition — the return value of `buildHumanRigBody`.
 *
 * `root` is attached into `UnitNode.body` at the same local position the
 * legacy monolithic sprite sat, so shadow + selection ring + HP bar +
 * label continue to anchor correctly without knowing which composition
 * path built the unit.
 *
 * The named sub-containers (`headSlot` / `shoulderSlotL` / `shoulderSlotR`
 * / `backSlot`) are empty in Phase 2 — Phase 3 (equipment visuals) will
 * populate them with helmets, shoulder pads, cloaks, and backpacks.
 *
 * `armsFront` is returned separately from `parts` because the caller
 * (createUnitNode) installs it inside the weapon wrap, not under `root`
 * — the front arm must ride with the weapon grip for aim + recoil.
 */
export interface RigBodyComposition {
  /** Root Container for body-bound parts (legs/torso/arms-back/head).
   *  Attached as a child of UnitNode.body at position (0, 0). */
  root: Container;

  /** Every named part sprite — Phase 4 animation addresses these by id
   *  to animate legs squash / torso lean / head counter-lean independently. */
  parts: Record<RigPartId, Sprite>;

  /** The arms-front Sprite, NOT parented into `root`. The caller should
   *  install it inside the weapon wrap so it rides with the grip. */
  armsFront: Sprite;

  /** Named attachment slots for equipment overlays. Populated in Phase 3. */
  headSlot: Container;
  shoulderSlotL: Container;
  shoulderSlotR: Container;
  backSlot: Container;

  /** All sprites that should receive the per-frame tint (dirt / hit-flash
   *  / death). animate.ts walks this list for rig-composed units. Phase 3
   *  overlays extend this when they attach. */
  tintTargets: Sprite[];
}

/**
 * Sprite scale shared with the legacy bespoke path. Matches the 96×128
 * viewBox → on-screen conversion that's been used for every existing
 * soldier/enemy sprite — keeping the number in sync means the rig's
 * joint offsets land at the same screen coordinates the old monolithic
 * sprites used.
 */
const SPRITE_SCALE = 0.42;

/**
 * Build a rigged body tree for a unit whose template provides an
 * `appearance`. Each rig part is instantiated as a Sprite positioned
 * via the rig's joint anchors, tinted by the appearance palette, and
 * assembled into a flat root container in the rig's draw order.
 *
 * Phase 2 applies `appearance.skinTone` as a whole-sprite tint on the
 * head and both arm parts (since the rasterised SVG texture no longer
 * carries class metadata — the Phase 1 authoring spec's `class="skin"`
 * hook is a future refinement, likely via separate skin-overlay SVGs).
 * Torso + legs are left at 0xffffff so cloth authored colour shows
 * through.
 *
 * @param rig    — the Rig definition (HUMAN_RIG for now).
 * @param appearance — the unit's palette (skin / hair / eye / outfit).
 * @param cache  — the shared sprite texture cache. Missing textures
 *                 fall through silently; the corresponding Sprite is
 *                 still created (empty) so the caller's layout logic
 *                 doesn't have to handle partial compositions.
 */
export function buildHumanRigBody(
  rig: Rig,
  appearance: HumanAppearance,
  cache: Map<string, Texture>,
): RigBodyComposition {
  const root = new Container();
  const tintTargets: Sprite[] = [];

  // Compute a shared local-origin offset for part sprites. The bespoke
  // path anchors the monolithic sprite at (0.5, 1) so its feet sit at
  // the container's origin. The rig uses per-part Sprites anchored at
  // (0, 0) with positions computed from rig.viewBox → local so the
  // stacked composition's feet land at the same origin.
  //
  // Screen origin (0, 0) in UnitNode.body == the ground beneath the
  // unit. Sprite.position.y is how far DOWN from that origin the part's
  // top-left lands. For a viewBox h=128 scaled by 0.42 ≈ 54px tall, we
  // want the foot to be at y=4 (matches the existing sprite.position.y
  // of the bespoke path) so the rig lines up vertically with shadows
  // authored for the old sprite.
  const footOffsetY = 4; // matches bespoke sprite.position.set(0, 4)
  const scaledH = rig.viewBox.h * SPRITE_SCALE;
  const partTopY = footOffsetY - scaledH;
  const partLeftX = -(rig.viewBox.w * SPRITE_SCALE) / 2;

  // Instantiate each part in the rig's draw order. The rig order IS the
  // z-order; Pixi draws children in the order they're added.
  const parts: Partial<Record<RigPartId, Sprite>> = {};
  for (const partId of rig.parts) {
    const sprite = new Sprite(cache.get(`rig:${rig.id}:${partId}`));
    sprite.anchor.set(0, 0);
    sprite.scale.set(SPRITE_SCALE);
    sprite.position.set(partLeftX, partTopY);
    parts[partId] = sprite;
    tintTargets.push(sprite);
    // arms-front is returned separately — it's parented into the
    // weapon wrap by the caller, not under `root`.
    if (partId !== 'arms-front') root.addChild(sprite);
  }

  // Apply skin tint to skin-dominant parts. Phase 1's docstring promised
  // class="skin" parsing; in Phase 2 we approximate with whole-sprite
  // tint on head + arms (the two parts whose exposed-skin coverage
  // dominates). Torso + legs keep 0xffffff so outfit/armor colour shows.
  applyPartTint(parts, 'head', appearance.skinTone);
  applyPartTint(parts, 'arms-back', appearance.skinTone);
  applyPartTint(parts, 'arms-front', appearance.skinTone);

  // Empty attachment slots — populated in Phase 3 when equipment overlays
  // land. Ordering matters: headSlot sits in front of the head sprite
  // (so helmets cover the head), shoulder slots sit in front of the
  // torso (so pads cover the shoulder seams), backSlot sits behind
  // the torso (so cloaks drape from the shoulders and fall behind the
  // body outline).
  const backSlot = new Container();
  const shoulderSlotL = new Container();
  const shoulderSlotR = new Container();
  const headSlot = new Container();

  // Insert backSlot at the appropriate z-level: after legs, before torso,
  // so cloaks hang behind the body but over the legs.
  const legsIndex = root.children.indexOf(parts.legs!);
  root.addChildAt(backSlot, legsIndex + 1);

  // Shoulder slots: anchored at their joint positions on top of the torso.
  shoulderSlotL.position.set(
    partLeftX + rig.joints['shoulder-l'].offset.x * SPRITE_SCALE,
    partTopY + rig.joints['shoulder-l'].offset.y * SPRITE_SCALE,
  );
  shoulderSlotR.position.set(
    partLeftX + rig.joints['shoulder-r'].offset.x * SPRITE_SCALE,
    partTopY + rig.joints['shoulder-r'].offset.y * SPRITE_SCALE,
  );
  root.addChild(shoulderSlotL, shoulderSlotR);

  // Head slot: on top of the head sprite.
  headSlot.position.set(
    partLeftX + rig.joints['head'].offset.x * SPRITE_SCALE,
    partTopY + rig.joints['head'].offset.y * SPRITE_SCALE,
  );
  const headIndex = root.children.indexOf(parts.head!);
  root.addChildAt(headSlot, headIndex + 1);

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

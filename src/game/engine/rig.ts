/**
 * Rig types used by both renderer and content packs. A `Rig` describes
 * the named body-part layout + joint anchors for a family of characters
 * (e.g. "human"). Concrete rigs with their part-SVG paths live in
 * `src/content/rigs/`; the engine consults the rig at render time to
 * compose each unit's sprite tree.
 *
 * The rig is opt-in: a `SoldierTemplate` (or eventually `EnemyTemplate`)
 * with `appearance: HumanAppearance` renders via the rig path; templates
 * without that field continue to render via the legacy bespoke
 * `${id}:body/arms/weapon` path in `src/game/rendering/units/UnitNode.ts`.
 */

/**
 * The five standard body parts of a rigged character. Draw order is
 * bottom → top: legs first (so feet plant under the torso silhouette),
 * torso, arms-back (behind the weapon), head, arms-front (inside the
 * weapon wrap so it tracks the grip).
 */
export type RigPartId =
  | 'legs'        // hips-down — squashes on foot-plant
  | 'torso'       // chest; leans with body
  | 'arms-back'   // off-hand / bracing arm; behind weapon
  | 'head'        // separate layer so helmets swap cleanly
  | 'arms-front'; // primary grip; rides inside weaponWrap

/**
 * Canonical joint anchor ids. Every rig defines an offset for each of
 * these; overlays (helmets, shoulder pads, cloaks, backpacks) attach
 * relative to these anchors so armor authors don't have to re-derive
 * positions per-character.
 */
export type RigJointId =
  | 'head'
  | 'neck'
  | 'shoulder-l'
  | 'shoulder-r'
  | 'waist'
  | 'grip'        // hand-on-weapon pivot — matches the existing GRIP_ANCHOR
  | 'foot-l'
  | 'foot-r';

export interface RigJoint {
  /**
   * Offset from the rig's viewBox top-left (y increases downward) to
   * this joint's pivot, at natural scale 1.0. Draw-time scale is
   * applied uniformly across parts so joint anchors stay aligned.
   */
  offset: { x: number; y: number };
}

export interface Rig {
  /** Unique id (e.g. 'human'). Looked up via rigById(id). */
  id: string;
  /**
   * The viewBox every authored part SVG must use. A rig's five part
   * SVGs are rasterised at this size and stacked in `parts` order.
   */
  viewBox: { w: number; h: number };
  /** Joint anchors keyed by RigJointId. */
  joints: Record<RigJointId, RigJoint>;
  /** Draw order (bottom → top). The renderer iterates this list. */
  parts: RigPartId[];
}

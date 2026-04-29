/** Durations (ms) for movement / hit / death animations. Shared between
 * updateUnitNode (schedules) and tickUnitAnimations (consumes). */
export const MOVE_TWEEN_MS = 260;
export const HIT_FLASH_MS = 240;
export const DEATH_DURATION_MS = 560;

/**
 * Grip pivot for the weapon layer, expressed as a fraction of the sprite's
 * 96×128 viewBox. The weapon sprite's anchor is set here so rotating it
 * pivots around the character's hand. This is a reasonable generic for all
 * seven Eagle Corps templates — weapons are authored waist-height, centered.
 */
export const GRIP_ANCHOR = { x: 0.5, y: 0.56 };

/** Muzzle position in weapon-wrap local coords (right-facing). Mirrored for left. */
export const MUZZLE_OFFSET = { x: 22, y: -2 };


/** Guardrails for additive animation channels before they are applied to sprites. */
export const ANIMATION_LIMITS = {
  // Torso rotation cap keeps the chest readable during stacked walk+recoil.
  torsoRotationRad: 0.14,
  // Neck compensation cap prevents the head from snapping while counter-leaning.
  headCounterRotationRad: 0.08,
  // Back arm sway cap keeps the shoulder from over-opening.
  armsBackSwayRad: 0.09,
  // Weapon rotation cap protects silhouette legibility at extreme aim+kick stacks.
  weaponAimRad: 0.32,
  // Weapon lift cap keeps shoulder elevation inside believable range.
  weaponLiftPx: 8.5,
} as const;

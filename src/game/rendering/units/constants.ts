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

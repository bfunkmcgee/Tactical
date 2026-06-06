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


import type { WeaponClass } from '../../types';

/** Guardrails for additive animation channels before they are applied to sprites.
 *  (Per-class weapon caps live in WEAPON_ANIMATION_LIMITS below.) */
export const ANIMATION_LIMITS = {
  // Torso rotation cap keeps the chest readable during stacked walk+recoil.
  torsoRotationRad: 0.14,
  // Neck compensation cap prevents the head from snapping while counter-leaning.
  headCounterRotationRad: 0.08,
  // Back arm sway cap keeps the shoulder from over-opening.
  armsBackSwayRad: 0.09,
} as const;


/**
 * Post-composition caps for the weapon channel. These must PRESERVE the
 * per-class character authored in FIRE_STYLES (fireStyles.ts), not flatten it:
 * the cap is derived as `windupRad + ~0.5·kickRad` (and `weaponLiftPx + ~4px`
 * of recoil headroom) so the full aim windup and roughly half the recoil snap
 * land before the guardrail engages. It still bounds pathological stacks
 * (windup + kick + aimYaw + future channels) for silhouette legibility.
 *
 * Ordering tracks FIRE_STYLES intent — sniper raises the most (deliberate,
 * eye-level mount), heavy the least (shouldered, compact). A prior pass set
 * these far below the authored values AND inverted the order (sniper 0.22,
 * pistol 0.40), which clamped every weapon into the same narrow band and made
 * the fire animations read as identical regardless of weapon. Keep these in
 * sync with FIRE_STYLES if those windup/kick/lift values change.
 */
export const WEAPON_ANIMATION_LIMITS: Record<WeaponClass | 'default', { rotationRad: number; liftPx: number }> = {
  sniper: { rotationRad: 0.92, liftPx: 20 },
  rifle: { rotationRad: 0.72, liftPx: 17 },
  shotgun: { rotationRad: 0.72, liftPx: 14 },
  pistol: { rotationRad: 0.60, liftPx: 13 },
  smg: { rotationRad: 0.48, liftPx: 13 },
  heavy: { rotationRad: 0.32, liftPx: 9 },
  default: { rotationRad: 0.64, liftPx: 14 },
};

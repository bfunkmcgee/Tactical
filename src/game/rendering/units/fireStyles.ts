import type { FireEvent } from '../../../state/combatStore';
import type { EnemyTemplate, FireStyleClass, UnitId, WeaponClass } from '../../types';
import { GRIP_ANCHOR } from './constants';
import { gridToScreen } from '../isoProjection';
import type { UnitNode } from './UnitNode';

/**
 * Per-weapon-class fire choreography. Drives how long the windup is, how
 * far the weapon rotates, how many shots fire (bursts for heavy/SMG), and
 * how big the muzzle flash reads.
 *
 * All phase durations are absolute ms (not fractions) so a burst-fire
 * heavy can hold a long shot window while a sniper still gets a short
 * single flash after a deliberate windup.
 */
export type FireStyle = {
  totalMs: number;
  windupMs: number;
  shotSpacingMs: number;  // ms between shot starts (0 for single-shot).
  shotWindowMs: number;   // how long each individual flash is visible.
  shots: number;
  windupRad: number;      // weapon rotation at end of windup (radians, positive = muzzle-up).
  kickRad: number;        // additional rotation at each shot (recoil).
  recoilPx: number;       // body kick-back distance on each shot.
  /**
   * How far the weapon grip lifts toward eye level during aim (pixels,
   * positive = up). The body stays planted; the arms/weapon move
   * independently so the unit "brings the gun up" rather than the whole
   * silhouette lurching.
   */
  weaponLiftPx: number;
  flashScale: number;     // size multiplier for drawMuzzleFlash.
};


export type { FireStyleClass };

/**
 * Rifle: Ranger brings the carbine up to cheekweld (big lift + rotation)
 *        before a single crisp shot.
 * Heavy: Warden keeps the autocannon shouldered; minimal lift, rapid
 *        flashes, low per-shot rotation.
 * Shotgun: Sapper's short windup with a strong chest-level raise, then
 *          one thundering wide blast with a big kick.
 * Sniper: Mystic's deliberate windup — weapon fully raised to the eye,
 *         single decisive shot.
 */
export const FIRE_STYLES: Record<WeaponClass | 'default', FireStyle> = {
  rifle:   { totalMs: 560, windupMs: 300, shotSpacingMs: 0,  shotWindowMs: 90,  shots: 1, windupRad: 0.55, kickRad: 0.32, recoilPx: 4, weaponLiftPx: 13, flashScale: 1.0 },
  sniper:  { totalMs: 720, windupMs: 430, shotSpacingMs: 0,  shotWindowMs: 100, shots: 1, windupRad: 0.72, kickRad: 0.40, recoilPx: 5, weaponLiftPx: 16, flashScale: 1.1 },
  shotgun: { totalMs: 520, windupMs: 200, shotSpacingMs: 0,  shotWindowMs: 140, shots: 1, windupRad: 0.42, kickRad: 0.55, recoilPx: 9, weaponLiftPx: 10, flashScale: 2.0 },
  heavy:   { totalMs: 680, windupMs: 110, shotSpacingMs: 80, shotWindowMs: 55,  shots: 4, windupRad: 0.24, kickRad: 0.12, recoilPx: 2, weaponLiftPx:  5, flashScale: 0.9 },
  smg:     { totalMs: 500, windupMs: 120, shotSpacingMs: 60, shotWindowMs: 45,  shots: 3, windupRad: 0.38, kickRad: 0.18, recoilPx: 2, weaponLiftPx:  9, flashScale: 0.8 },
  pistol:  { totalMs: 400, windupMs: 170, shotSpacingMs: 0,  shotWindowMs: 80,  shots: 1, windupRad: 0.45, kickRad: 0.28, recoilPx: 3, weaponLiftPx:  9, flashScale: 0.8 },
  default: { totalMs: 440, windupMs: 200, shotSpacingMs: 0,  shotWindowMs: 90,  shots: 1, windupRad: 0.48, kickRad: 0.30, recoilPx: 3, weaponLiftPx: 10, flashScale: 1.0 },
};

/**
 * Per-weapon-class hold profile — how the weapon AND the front arm are
 * mounted on the unit. Sibling table to FIRE_STYLES; consumed by
 * UnitNode.ts at weapon-mount time and animate.ts for muzzle flash.
 *
 * Replaces the single global GRIP_ANCHOR + uniform 0.42 scale + inlined
 * weaponRestY formula that collapsed every class through one transform —
 * which left a pistol rendering at the same on-screen size as a rifle,
 * the weapon hanging ~5-12 px low because the global anchor didn't
 * coincide with any class's drawn grip dot, and every class showing the
 * same two-hand center grip.
 *
 * Numbers are starting values from the SVG grip / barrel survey
 * (rifle grip y=60, pistol y=70, etc. in the 96x128 viewBox); tune in a
 * playtest pass after wiring is in place.
 */
export type WeaponHold = {
  /** Sprite anchor (fraction of 96x128 viewBox) for the weapon AND the
   *  arms-front sprite. Coincides with the SVG's drawn grip dot per
   *  class so rotation pivots around the hand instead of mid-air. */
  gripAnchor: { x: number; y: number };
  /** Uniform scale applied to weaponSprite + armsFront. Pistol < rifle
   *  < heavy so silhouettes scale with the gun's real-world bulk. */
  scale: number;
  /** Forward (+x, right-facing) and vertical offset of the muzzle in
   *  weapon-wrap LOCAL pixels AFTER scale. Mirrored by `* facing` for
   *  left. Consumed by drawMuzzleFlash so the flash lands at the SVG's
   *  barrel tip rather than the global ~+22px point. */
  muzzleOffset: { x: number; y: number };
  /** Vertical y for the weaponWrap at rest (low-ready). Per-class so a
   *  pistol can hang low at the hip while a heavy rides shouldered.
   *  Replaces the formula UnitNode used to inline. */
  restY: number;
  /** Optional per-class arms-front pivot override. The front arm is a body
   *  part drawn with its hand at GRIP_ANCHOR (~48,72), so it defaults to
   *  GRIP_ANCHOR — which lands the drawn hand on the weapon's grip. Only set
   *  this if a weapon needs a bespoke arm pose. */
  armsAnchor?: { x: number; y: number };
  /** Optional per-class arms-front scale. Defaults to SPRITE_SCALE (the body
   *  scale) so the front arm matches the back arm / torso rather than the
   *  weapon's bulk. Only set this for a bespoke arm. */
  armsScale?: number;
};

// muzzleOffset per class = (weapon SVG's drawn muzzle-glow centre − gripAnchor)
// × scale, i.e. the barrel tip expressed in scaled weaponWrap-local pixels so
// drawMuzzleFlash lands the flash on the rune/ember core. Derived from the
// representative weapon of each class (e.g. runeweave_carbine glow at 86,64).
export const WEAPON_HOLD: Record<WeaponClass | 'default', WeaponHold> = {
  // Shoulder-fire baseline: carbine stays near shoulder pocket with a stable two-hand frame.
  rifle:   { gripAnchor: { x: 0.50, y: 60 / 128 }, scale: 0.44, muzzleOffset: { x: 16.7, y: 1.8 }, restY: -28 },
  // Eye-level precision: long rifle mounts highest for deliberate sighted shots.
  sniper:  { gripAnchor: { x: 0.50, y: 60 / 128 }, scale: 0.46, muzzleOffset: { x: 18.4, y: -0.5 }, restY: -32 },
  // Shoulder-fire with blast posture: compact raise and broad muzzle presentation.
  shotgun: { gripAnchor: { x: 0.50, y: 64 / 128 }, scale: 0.44, muzzleOffset: { x: 19.4, y: 1.8 }, restY: -26 },
  // Hip-to-shoulder spray: compact profile sits below rifle and flashes slightly closer to body.
  smg:     { gripAnchor: { x: 0.50, y: 70 / 128 }, scale: 0.38, muzzleOffset: { x: 14.4, y: -1.9 }, restY: -21 },
  // Hip-fire sidearm: compact, low-slung. Arm uses the shared body-scaled
  // front arm (default GRIP_ANCHOR / SPRITE_SCALE) so the hand sits on the grip.
  pistol:  { gripAnchor: { x: 0.50, y: 70 / 128 }, scale: 0.32, muzzleOffset: { x: 10.9, y: -1.6 }, restY: -14 },
  // Shoulder-fire support weapon: high mount and slightly lower grip pivot to emphasize carried mass.
  heavy:   { gripAnchor: { x: 0.45, y: 65 / 128 }, scale: 0.50, muzzleOffset: { x: 24.9, y: 0.5 }, restY: -22 },
  // 'default' mirrors the pre-WEAPON_HOLD shipping numbers exactly so any
  // unit without a resolvable class falls through bug-compatible:
  // gripAnchor = GRIP_ANCHOR (0.5, 0.56), scale = 0.42, restY = (0.56 - 1) * 128 * 0.42 + 4.
  default: { gripAnchor: { ...GRIP_ANCHOR },        scale: 0.42, muzzleOffset: { x: 22, y: -2 }, restY: -19.6 },
};


export const MELEE_STYLE: FireStyle = {
  totalMs: 520,
  windupMs: 220,
  shotSpacingMs: 0,
  shotWindowMs: 130,
  shots: 1,
  windupRad: 0.92,
  kickRad: 0.18,
  recoilPx: 7,
  weaponLiftPx: 0,
  flashScale: 0,
};

export function resolveFireStyleClass(args: { fireClass?: WeaponClass; enemyTemplate?: EnemyTemplate }): FireStyleClass {
  if (args.enemyTemplate?.kind === 'melee') return 'melee';
  if (args.fireClass) return args.fireClass;
  return 'default';
}

export function resolveFireStyle(styleClass: FireStyleClass): FireStyle {
  if (styleClass === 'melee') return MELEE_STYLE;
  return FIRE_STYLES[styleClass] ?? FIRE_STYLES.default;
}

/**
 * Drain pending FireEvents and trigger the correct animation on each
 * shooter's node. Events are authoritative (they carry the actual
 * target and weapon class from the combat resolvers), so the renderer
 * doesn't have to guess from ammo deltas or "nearest enemy" heuristics.
 */
export function applyFireEvents(nodes: Map<UnitId, UnitNode>, events: FireEvent[]) {
  for (const evt of events) {
    const node = nodes.get(evt.shooterId);
    if (!node) continue;
    const from = gridToScreen(evt.shooterPos);
    const to = gridToScreen(evt.targetPos);
    const dx = to.x - from.x, dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    node.fireTargetDir = { x: dx / len, y: dy / len };
    node.fireClass = evt.fireClass ?? "default";
    node.fireStyle = resolveFireStyle(evt.fireClass);
    node.fireAnimMs = node.fireStyle.totalMs;
    if (Math.abs(dx) > 0.5) {
      const desiredFacing = dx > 0 ? 1 : -1;
      if (desiredFacing !== node.targetFacing) {
        node.targetFacing = desiredFacing;
        node.facingTurnMs = 0;
        node.facingTurnDurationMs = Math.max(80, Math.min(140, 80 + node.fireStyle.windupMs * 0.15));
      }
    }
  }
}

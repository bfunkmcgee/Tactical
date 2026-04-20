import type { GridMap, HitModifier, ShotPreview, Unit, Weapon, Armor, CoverState } from '../types';
import { chebyshev } from './grid';
import { hasLineOfSight, getCoverState } from './los';
import type { RNG } from './rng';

const COVER_PENALTY: Record<CoverState, number> = { none: 0, half: 20, full: 40 };
const BASE_HIT = 65;

/** Small helper: stacks modifiers into a clamped 1..99 hit chance. */
function finalizeHit(modifiers: HitModifier[]): number {
  const sum = modifiers.reduce((s, m) => s + m.value, 0);
  return Math.max(1, Math.min(99, sum));
}

/** Range-band penalty: 0 within short, ramps linearly to −40 at long range. */
function rangePenalty(dist: number, rangeShort: number, rangeLong: number): number {
  if (dist <= rangeShort) return 0;
  const band = Math.max(1, rangeLong - rangeShort);
  return -Math.min(40, Math.round(((dist - rangeShort) / band) * 40));
}

/**
 * Compute shot preview for a player weapon vs. a target.
 * `smokeTiles` optionally blocks LOS through any smoke-covered tile.
 */
export function previewShot(
  m: GridMap,
  shooter: Unit,
  target: Unit,
  weapon: Weapon,
  targetArmorDr: number,
  smokeTiles?: ReadonlySet<number>
): ShotPreview {
  const dist = chebyshev(shooter.pos, target.pos);
  const inRange = dist <= weapon.rangeLong;
  const los = hasLineOfSight(m, shooter.pos, target.pos, smokeTiles);
  const cover = getCoverState(m, shooter.pos, target.pos);

  const modifiers: HitModifier[] = [{ label: 'base', value: BASE_HIT }];
  if (shooter.aim) modifiers.push({ label: shooter.name, value: shooter.aim });
  if (weapon.aim) modifiers.push({ label: weapon.name, value: weapon.aim });
  const rangeMod = rangePenalty(dist, weapon.rangeShort, weapon.rangeLong);
  if (rangeMod) modifiers.push({ label: `range ${dist}`, value: rangeMod });
  if (cover !== 'none') modifiers.push({ label: `${cover} cover`, value: -COVER_PENALTY[cover] });
  if (shooter.status.blinded) modifiers.push({ label: 'blinded', value: -40 });
  if (shooter.status.suppressed) modifiers.push({ label: 'suppressed', value: -20 });

  const hitChance = finalizeHit(modifiers);

  const critChance = Math.max(0, Math.min(100, weapon.crit + (cover === 'none' ? 25 : 0)));
  const dmgMin = Math.max(0, weapon.dmgMin - targetArmorDr);
  const dmgMax = Math.max(0, weapon.dmgMax - targetArmorDr);

  return {
    hitChance, critChance, cover, dmgMin, dmgMax, inRange, hasLOS: los, modifiers,
  };
}

export type ShotResult =
  | { kind: 'miss'; hitRoll: number }
  | { kind: 'hit'; damage: number; critical: boolean; hitRoll: number };

export function resolveShot(preview: ShotPreview, weapon: Weapon, armor: Armor | null, rng: RNG): ShotResult {
  const hitRoll = rng.int(100) + 1;
  if (hitRoll > preview.hitChance) return { kind: 'miss', hitRoll };
  const critRoll = rng.int(100) + 1;
  const critical = critRoll <= preview.critChance;
  const base = weapon.dmgMin + rng.int(weapon.dmgMax - weapon.dmgMin + 1);
  const raw = critical ? Math.round(base * 1.5) : base;
  const damage = Math.max(1, raw - (armor ? armor.dr : 0));
  return { kind: 'hit', damage, critical, hitRoll };
}

/**
 * Enemy attack resolution uses the enemy's own stats (populated on the Unit
 * from its template at spawn time). Previously hardcoded; now each enemy
 * class hits for their own damage/range.
 */
export function resolveEnemyAttack(
  m: GridMap,
  shooter: Unit,
  target: Unit,
  targetArmorDr: number,
  rng: RNG,
  smokeTiles?: ReadonlySet<number>
): ShotResult & { preview: ShotPreview } {
  const dist = chebyshev(shooter.pos, target.pos);
  const los = hasLineOfSight(m, shooter.pos, target.pos, smokeTiles);
  const cover = getCoverState(m, shooter.pos, target.pos);

  const modifiers: HitModifier[] = [{ label: shooter.name, value: shooter.aim }];
  const rangeMod = rangePenalty(dist, shooter.rangeShort, shooter.rangeLong);
  if (rangeMod) modifiers.push({ label: `range ${dist}`, value: rangeMod });
  if (cover !== 'none') modifiers.push({ label: `${cover} cover`, value: -COVER_PENALTY[cover] });
  if (shooter.status.blinded) modifiers.push({ label: 'blinded', value: -40 });

  const hitChance = finalizeHit(modifiers);
  const critChance = 10 + (cover === 'none' ? 10 : 0);

  const preview: ShotPreview = {
    hitChance, critChance, cover,
    dmgMin: Math.max(0, shooter.dmgMin - targetArmorDr),
    dmgMax: Math.max(0, shooter.dmgMax - targetArmorDr),
    inRange: dist <= shooter.rangeLong,
    hasLOS: los,
    modifiers,
  };

  const roll = rng.int(100) + 1;
  if (roll > hitChance) return { kind: 'miss', hitRoll: roll, preview };
  const base = shooter.dmgMin + rng.int(shooter.dmgMax - shooter.dmgMin + 1);
  const critical = (rng.int(100) + 1) <= critChance;
  const raw = critical ? Math.round(base * 1.5) : base;
  const damage = Math.max(1, raw - targetArmorDr);
  return { kind: 'hit', damage, critical, hitRoll: roll, preview };
}

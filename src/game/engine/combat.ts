import type { GridMap, ShotPreview, Unit, Weapon, Armor, CoverState } from '../types';
import { chebyshev } from './grid';
import { hasLineOfSight, getCoverState } from './los';
import type { RNG } from './rng';

const COVER_PENALTY: Record<CoverState, number> = { none: 0, half: 20, full: 40 };

/** Compute shot preview (hit %, damage range, cover, LOS, range flags). */
export function previewShot(
  m: GridMap,
  shooter: Unit,
  target: Unit,
  weapon: Weapon,
  targetArmorDr: number
): ShotPreview {
  const dist = chebyshev(shooter.pos, target.pos);
  const inRange = dist <= weapon.rangeLong;
  const los = hasLineOfSight(m, shooter.pos, target.pos);
  const cover = getCoverState(m, shooter.pos, target.pos);

  let hit = weapon.aim + shooter.aim + 65; // 65% base
  // Range falloff beyond short range.
  if (dist > weapon.rangeShort) {
    const over = dist - weapon.rangeShort;
    const band = Math.max(1, weapon.rangeLong - weapon.rangeShort);
    hit -= Math.min(40, Math.round((over / band) * 40));
  }
  hit -= COVER_PENALTY[cover];
  if (shooter.status.blinded) hit -= 40;
  if (shooter.status.suppressed) hit -= 20;
  hit = Math.max(1, Math.min(99, hit));

  let crit = weapon.crit;
  if (cover === 'none') crit += 25; // flanking bonus

  const dmgMin = Math.max(0, weapon.dmgMin - targetArmorDr);
  const dmgMax = Math.max(0, weapon.dmgMax - targetArmorDr);

  return {
    hitChance: hit,
    critChance: Math.max(0, Math.min(100, crit)),
    cover,
    dmgMin, dmgMax,
    inRange, hasLOS: los,
  };
}

export type ShotResult =
  | { kind: 'miss'; hitRoll: number }
  | { kind: 'hit'; damage: number; critical: boolean; hitRoll: number };

export function resolveShot(preview: ShotPreview, weapon: Weapon, armor: Armor | null, rng: RNG): ShotResult {
  const hitRoll = rng.int(100) + 1; // 1..100
  if (hitRoll > preview.hitChance) return { kind: 'miss', hitRoll };
  const critRoll = rng.int(100) + 1;
  const critical = critRoll <= preview.critChance;
  const base = weapon.dmgMin + rng.int(weapon.dmgMax - weapon.dmgMin + 1);
  const raw = critical ? Math.round(base * 1.5) : base;
  const damage = Math.max(1, raw - (armor ? armor.dr : 0));
  return { kind: 'hit', damage, critical, hitRoll };
}

/** Enemy basic attack uses enemy stats directly (no weapon data). */
export function resolveEnemyAttack(
  m: GridMap,
  shooter: Unit,
  target: Unit,
  targetArmorDr: number,
  rng: RNG
): ShotResult & { preview: ShotPreview } {
  const dist = chebyshev(shooter.pos, target.pos);
  const los = hasLineOfSight(m, shooter.pos, target.pos);
  const cover = getCoverState(m, shooter.pos, target.pos);
  let hit = shooter.aim;
  if (dist > 6) hit -= 10;
  hit -= COVER_PENALTY[cover];
  if (shooter.status.blinded) hit -= 40;
  hit = Math.max(1, Math.min(99, hit));
  const preview: ShotPreview = {
    hitChance: hit,
    critChance: 10,
    cover,
    dmgMin: Math.max(0, 3 - targetArmorDr),
    dmgMax: Math.max(0, 6 - targetArmorDr),
    inRange: dist <= 12,
    hasLOS: los,
  };
  const roll = rng.int(100) + 1;
  if (roll > hit) return { kind: 'miss', hitRoll: roll, preview };
  const base = 3 + rng.int(4); // 3..6
  const critical = rng.int(100) < 10;
  const raw = critical ? Math.round(base * 1.5) : base;
  const damage = Math.max(1, raw - targetArmorDr);
  return { kind: 'hit', damage, critical, hitRoll: roll, preview };
}

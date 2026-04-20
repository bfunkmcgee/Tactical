import type { GridMap, HitModifier, ShotPreview, Unit, Weapon, Armor, CoverState, WeaponMod } from '../types';
import { chebyshev } from './grid';
import { hasLineOfSight, getCoverState } from './los';
import type { RNG } from './rng';
import { resolveWeapon } from './loadout';

const COVER_PENALTY: Record<CoverState, number> = { none: 0, half: 20, full: 40 };
const BASE_HIT = 65;
const PIERCING_DR_REDUCTION = 2;

function finalizeHit(modifiers: HitModifier[]): number {
  const sum = modifiers.reduce((s, m) => s + m.value, 0);
  return Math.max(1, Math.min(99, sum));
}

function rangePenalty(dist: number, rangeShort: number, rangeLong: number): number {
  if (dist <= rangeShort) return 0;
  const band = Math.max(1, rangeLong - rangeShort);
  return -Math.min(40, Math.round(((dist - rangeShort) / band) * 40));
}

/**
 * Compute shot preview for a player weapon vs. a target.
 * `mods` are the equipped attachments — they fold into an effective weapon
 * before any other math. `smokeTiles` blocks LOS unless the weapon has
 * the `thermal` flag.
 */
export function previewShot(
  m: GridMap,
  shooter: Unit,
  target: Unit,
  weapon: Weapon,
  targetArmorDr: number,
  smokeTiles?: ReadonlySet<number>,
  mods: WeaponMod[] = []
): ShotPreview {
  const resolved = resolveWeapon(weapon, mods);
  const eff = resolved.effective;

  const dist = chebyshev(shooter.pos, target.pos);
  const inRange = dist <= eff.rangeLong;

  // Thermal optic ignores smoke.
  const losExtraBlockers = resolved.flags.has('thermal') ? undefined : smokeTiles;
  const los = hasLineOfSight(m, shooter.pos, target.pos, losExtraBlockers);
  const cover = getCoverState(m, shooter.pos, target.pos);

  const modifiers: HitModifier[] = [{ label: 'base', value: BASE_HIT }];
  if (shooter.aim) modifiers.push({ label: shooter.name, value: shooter.aim });
  // Base weapon aim + each mod aim contribution as separate labelled rows.
  modifiers.push(...resolved.aimContribs);

  const rangeMod = resolved.flags.has('no_range_falloff')
    ? 0
    : rangePenalty(dist, eff.rangeShort, eff.rangeLong);
  if (rangeMod) modifiers.push({ label: `range ${dist}`, value: rangeMod });
  if (cover !== 'none') modifiers.push({ label: `${cover} cover`, value: -COVER_PENALTY[cover] });
  if (shooter.status.blinded) modifiers.push({ label: 'blinded', value: -40 });
  if (shooter.status.suppressed) modifiers.push({ label: 'suppressed', value: -20 });

  const hitChance = finalizeHit(modifiers);

  const critChance = Math.max(0, Math.min(100, eff.crit + (cover === 'none' ? 25 : 0)));
  const effectiveDr = Math.max(0,
    targetArmorDr - (resolved.flags.has('piercing') ? PIERCING_DR_REDUCTION : 0));
  const dmgMin = Math.max(0, eff.dmgMin - effectiveDr);
  const dmgMax = Math.max(0, eff.dmgMax - effectiveDr);

  return {
    hitChance, critChance, cover, dmgMin, dmgMax, inRange, hasLOS: los, modifiers,
  };
}

export type ShotResult =
  | { kind: 'miss'; hitRoll: number }
  | { kind: 'hit'; damage: number; critical: boolean; hitRoll: number; ammoRefund: boolean };

export function resolveShot(
  preview: ShotPreview,
  weapon: Weapon,
  armor: Armor | null,
  rng: RNG,
  mods: WeaponMod[] = []
): ShotResult {
  const resolved = resolveWeapon(weapon, mods);
  const eff = resolved.effective;
  const hitRoll = rng.int(100) + 1;
  if (hitRoll > preview.hitChance) return { kind: 'miss', hitRoll };
  const critRoll = rng.int(100) + 1;
  const critical = critRoll <= preview.critChance;
  const base = eff.dmgMin + rng.int(eff.dmgMax - eff.dmgMin + 1);
  const raw = critical ? Math.round(base * 1.5) : base;
  const armorDr = armor ? armor.dr : 0;
  const effectiveDr = Math.max(0,
    armorDr - (resolved.flags.has('piercing') ? PIERCING_DR_REDUCTION : 0));
  const damage = Math.max(1, raw - effectiveDr);
  const ammoRefund = critical && resolved.flags.has('recover_ammo_on_crit');
  return { kind: 'hit', damage, critical, hitRoll, ammoRefund };
}

/**
 * Enemy attack resolution uses the enemy's own stats from its template.
 * Enemies have no mod system, so flags/contributions don't apply here.
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
  return { kind: 'hit', damage, critical, hitRoll: roll, ammoRefund: false, preview };
}

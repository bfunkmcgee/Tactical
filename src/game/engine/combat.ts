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
  | { kind: 'miss'; hitRoll: number; burstRounds?: number }
  | {
      kind: 'hit';
      damage: number;
      critical: boolean;
      hitRoll: number;
      ammoRefund: boolean;
      /** Rounds that connected out of `burstRounds` total. Single-shot
       *  weapons omit both for backward compat. */
      hits?: number;
      burstRounds?: number;
    };

/**
 * Roll a shot. Automatic weapons (Weapon.burstShots > 1) roll each
 * round independently at the shot's hit chance — per-round damage is
 * `dmg/burstShots` so total burst damage tracks the listed value but
 * with lower variance than a single-shot weapon. Armor DR applies
 * per round (armour is stronger against spray).
 *
 * The returned `hits` + `burstRounds` surface "2/3 rounds connected"
 * for HUD copy; callers that don't care can ignore them.
 */
export function resolveShot(
  preview: ShotPreview,
  weapon: Weapon,
  armor: Armor | null,
  rng: RNG,
  mods: WeaponMod[] = []
): ShotResult {
  const resolved = resolveWeapon(weapon, mods);
  const eff = resolved.effective;
  const burstShots = Math.max(1, weapon.burstShots ?? 1);
  const armorDr = armor ? armor.dr : 0;
  const effectiveDr = Math.max(0,
    armorDr - (resolved.flags.has('piercing') ? PIERCING_DR_REDUCTION : 0));

  // Per-round damage band. Floor of 1 for tiny-damage bursts so rounds
  // always contribute when they connect.
  const perRoundMin = Math.max(1, Math.ceil(eff.dmgMin / burstShots));
  const perRoundMax = Math.max(perRoundMin, Math.ceil(eff.dmgMax / burstShots));

  let totalDamage = 0;
  let hits = 0;
  let anyCrit = false;
  let firstRoll = 0;

  for (let i = 0; i < burstShots; i++) {
    const hitRoll = rng.int(100) + 1;
    if (i === 0) firstRoll = hitRoll;
    if (hitRoll > preview.hitChance) continue;
    hits++;
    const critRoll = rng.int(100) + 1;
    const critical = critRoll <= preview.critChance;
    if (critical) anyCrit = true;
    const base = perRoundMin + rng.int(perRoundMax - perRoundMin + 1);
    const raw = critical ? Math.round(base * 1.5) : base;
    totalDamage += Math.max(1, raw - effectiveDr);
  }

  if (hits === 0) {
    return burstShots > 1
      ? { kind: 'miss', hitRoll: firstRoll, burstRounds: burstShots }
      : { kind: 'miss', hitRoll: firstRoll };
  }
  const ammoRefund = anyCrit && resolved.flags.has('recover_ammo_on_crit');
  const result: ShotResult = {
    kind: 'hit', damage: totalDamage, critical: anyCrit, hitRoll: firstRoll, ammoRefund,
  };
  if (burstShots > 1) {
    result.hits = hits;
    result.burstRounds = burstShots;
  }
  return result;
}

/**
 * Enemy attack resolution uses the enemy's own stats from its template.
 * Enemies have no mod system, so flags/contributions don't apply here.
 *
 * If the shooter's template carries `burstShots > 1` the attack is a
 * burst: each round rolls independently and per-round damage is the
 * shooter's dmg stat divided by the burst count. Same model the player
 * weapons use.
 */
export function resolveEnemyAttack(
  m: GridMap,
  shooter: Unit,
  target: Unit,
  targetArmorDr: number,
  rng: RNG,
  smokeTiles?: ReadonlySet<number>,
  burstShotsOverride?: number,
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

  const burstShots = Math.max(1, burstShotsOverride ?? 1);
  const perRoundMin = Math.max(1, Math.ceil(shooter.dmgMin / burstShots));
  const perRoundMax = Math.max(perRoundMin, Math.ceil(shooter.dmgMax / burstShots));

  let totalDamage = 0;
  let hits = 0;
  let anyCrit = false;
  let firstRoll = 0;

  for (let i = 0; i < burstShots; i++) {
    const roll = rng.int(100) + 1;
    if (i === 0) firstRoll = roll;
    if (roll > hitChance) continue;
    hits++;
    const critical = (rng.int(100) + 1) <= critChance;
    if (critical) anyCrit = true;
    const base = perRoundMin + rng.int(perRoundMax - perRoundMin + 1);
    const raw = critical ? Math.round(base * 1.5) : base;
    totalDamage += Math.max(1, raw - targetArmorDr);
  }

  if (hits === 0) {
    return burstShots > 1
      ? { kind: 'miss', hitRoll: firstRoll, burstRounds: burstShots, preview }
      : { kind: 'miss', hitRoll: firstRoll, preview };
  }
  const result: ShotResult & { preview: ShotPreview } = {
    kind: 'hit', damage: totalDamage, critical: anyCrit,
    hitRoll: firstRoll, ammoRefund: false, preview,
  };
  if (burstShots > 1) {
    result.hits = hits;
    result.burstRounds = burstShots;
  }
  return result;
}

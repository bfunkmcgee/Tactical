import type { HitModifier, ModSlot, Weapon, WeaponFlag, WeaponMod } from '../types';
import { MODS } from '../data/mods';

export type ResolvedWeapon = {
  effective: Weapon;            // base + summed mod stats
  flags: Set<WeaponFlag>;       // active effect flags
  mobilityDelta: number;        // wielder mobility delta from mods (e.g. heavy stock)
  aimContribs: HitModifier[];   // pre-formatted modifier rows for the shot preview
};

/**
 * Sum mods onto a base weapon. Each contribution to aim becomes a labelled
 * `HitModifier` so the preview UI can show "+15 Marksman Scope, -10 Drum Mag"
 * inline with the existing range/cover/blinded breakdown.
 */
export function resolveWeapon(base: Weapon, mods: WeaponMod[]): ResolvedWeapon {
  const effective: Weapon = { ...base };
  const flags = new Set<WeaponFlag>();
  const aimContribs: HitModifier[] = [];
  let mobilityDelta = 0;
  if (base.aim) aimContribs.push({ label: base.name, value: base.aim });
  for (const m of mods) {
    if (m.effects.aim) {
      effective.aim = (effective.aim ?? 0) + m.effects.aim;
      aimContribs.push({ label: m.name, value: m.effects.aim });
    }
    if (m.effects.crit) effective.crit = (effective.crit ?? 0) + m.effects.crit;
    if (m.effects.dmgMin) effective.dmgMin = Math.max(0, effective.dmgMin + m.effects.dmgMin);
    if (m.effects.dmgMax) effective.dmgMax = Math.max(effective.dmgMin, effective.dmgMax + m.effects.dmgMax);
    if (m.effects.rangeShort) effective.rangeShort = Math.max(1, effective.rangeShort + m.effects.rangeShort);
    if (m.effects.rangeLong) effective.rangeLong = Math.max(effective.rangeShort, effective.rangeLong + m.effects.rangeLong);
    if (m.effects.ammo) effective.ammo = Math.max(1, effective.ammo + m.effects.ammo);
    if (m.effects.mobility) mobilityDelta += m.effects.mobility;
    if (m.effects.flags) for (const f of m.effects.flags) flags.add(f);
  }
  return { effective, flags, mobilityDelta, aimContribs };
}

/** Look up the WeaponMods currently equipped to a weapon's slot map. */
export function modsFromIds(slotMap: Partial<Record<ModSlot, string>>): WeaponMod[] {
  const out: WeaponMod[] = [];
  for (const slot of Object.keys(slotMap) as ModSlot[]) {
    const id = slotMap[slot];
    if (!id) continue;
    const m = MODS[id];
    if (m) out.push(m);
  }
  return out;
}

/** Sum every wielder-side mobility delta across both equipped weapon mod sets. */
export function totalMobilityDeltaFromMods(
  primaryMods: Partial<Record<ModSlot, string>>,
  sidearmMods: Partial<Record<ModSlot, string>>,
): number {
  return modsFromIds(primaryMods).concat(modsFromIds(sidearmMods))
    .reduce((s, m) => s + (m.effects.mobility ?? 0), 0);
}

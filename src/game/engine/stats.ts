import type { Kit } from '../types';

/**
 * Pure derivation of spawn-time soldier stats. Folds the template
 * baseline + armor aggregates + kit effects + weapon-mod mobility into
 * the four numbers the unit carries into combat (hpMax, mobility, aim,
 * ammo caps). Extracted from `mkSoldierUnit` so the clamps can be
 * exercised without spinning up combatStore / content registry.
 *
 * Invariants pinned by the tests in `src/game/engine/edgeCases.test.ts`:
 *   - hpMax clamps floor 1 — a soldier with hideously negative bonuses
 *     still spawns at 1 HP.
 *   - mobility clamps floor 2 — even the slowest combination can
 *     advance 2 tiles per turn.
 *   - ammo caps don't clamp; negative effects would push below zero.
 *     Current pack content has no negative ammo mods, so this is a
 *     pragmatic "trust content" seam rather than an engine guard.
 */
export interface SoldierStatInputs {
  baseHp: number;
  baseMobility: number;
  baseAim: number;
  primaryAmmoBase: number;
  sidearmAmmoBase: number;
  armorHpBonus: number;
  armorMobility: number;
  kitEffects: Kit['effects'];
  modMobility: number;
}

export interface SoldierStats {
  hpMax: number;
  mobility: number;
  aim: number;
  ammoPrimaryMax: number;
  ammoSidearmMax: number;
}

export function deriveSoldierStats(i: SoldierStatInputs): SoldierStats {
  const k = i.kitEffects;
  return {
    hpMax: Math.max(1, i.baseHp + i.armorHpBonus + (k.hpBonus ?? 0)),
    mobility: Math.max(
      2,
      i.baseMobility + i.armorMobility + (k.mobilityBonus ?? 0) + i.modMobility,
    ),
    aim: i.baseAim + (k.aimBonus ?? 0),
    ammoPrimaryMax: i.primaryAmmoBase + (k.extraAmmoPrimary ?? 0),
    ammoSidearmMax: i.sidearmAmmoBase + (k.extraAmmoSidearm ?? 0),
  };
}

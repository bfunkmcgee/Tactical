import { describe, it, expect } from 'vitest';
import { aggregateArmorStat, equippedArmorPieces } from './registry';

/**
 * Phase 6a — armor piece aggregation. `Loadout.armor` is a per-slot
 * map; stats sum across every equipped piece. These helpers are the
 * single source of truth for how HP / DR / mobility combine, so tests
 * pin them here to catch drift.
 *
 * The active pack at test time is Eagle Corps, which ships the
 * decomposed pieces referenced below (see src/content/packs/eagle-corps/
 * armor.ts).
 */
describe('registry: armor piece aggregation', () => {
  it('sums hpBonus / dr / mobility across a full assault_plate set', () => {
    // assault_plate was one monolith: hp 4 / dr 2 / mob -1. The five
    // decomposed pieces must sum to the same totals or the migration
    // silently buffs / nerfs existing squads.
    const armor = {
      helmet: 'assault_plate_helmet',
      shoulders: 'assault_plate_shoulders',
      chest: 'assault_plate_chest',
      legs: 'assault_plate_legs',
      gauntlets: 'assault_plate_gauntlets',
    };
    expect(aggregateArmorStat(armor, 'hpBonus')).toBe(4);
    expect(aggregateArmorStat(armor, 'dr')).toBe(2);
    expect(aggregateArmorStat(armor, 'mobility')).toBe(-1);
    expect(equippedArmorPieces(armor)).toHaveLength(5);
  });

  it('mix-and-match across two armor families aggregates correctly', () => {
    // warded_plate_chest (hp 2 / dr 1 / mob 0) + swiftstep_greaves_legs
    // (hp 1 / dr 0 / mob +1) = hp 3 / dr 1 / mob +1.
    const armor = {
      chest: 'warded_plate_chest',
      legs: 'swiftstep_greaves_legs',
    };
    expect(aggregateArmorStat(armor, 'hpBonus')).toBe(3);
    expect(aggregateArmorStat(armor, 'dr')).toBe(1);
    expect(aggregateArmorStat(armor, 'mobility')).toBe(1);
  });

  it('empty armor map aggregates to zero and skips unknown piece ids', () => {
    expect(aggregateArmorStat({}, 'hpBonus')).toBe(0);
    expect(aggregateArmorStat({ chest: 'no_such_piece' }, 'dr')).toBe(0);
    expect(equippedArmorPieces({ chest: 'no_such_piece' })).toEqual([]);
  });
});

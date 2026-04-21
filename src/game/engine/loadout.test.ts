import { describe, it, expect } from 'vitest';
import { resolveWeapon } from './loadout';
import { useContent } from '../../content/registry';

const MODS = useContent().mods;
const WEAPONS = useContent().weapons;

const carbine = WEAPONS.runeweave_carbine!;

describe('resolveWeapon', () => {
  it('returns the base weapon unchanged with no mods', () => {
    const r = resolveWeapon(carbine, []);
    expect(r.effective.aim).toBe(carbine.aim);
    expect(r.effective.dmgMin).toBe(carbine.dmgMin);
    expect(r.effective.ammo).toBe(carbine.ammo);
    expect(r.flags.size).toBe(0);
    expect(r.mobilityDelta).toBe(0);
  });

  it('sums aim contributions and emits one HitModifier per contributing mod', () => {
    const reflex = MODS.optic_reflex!;
    const drum = MODS.mag_drum!;
    const r = resolveWeapon(carbine, [reflex, drum]);
    // Reflex +5 / drum -10 apply on top of the carbine's base aim.
    expect(r.effective.aim).toBe(carbine.aim + 5 - 10);
    const labels = r.aimContribs.map((c) => c.label);
    expect(labels).toContain(reflex.name);
    expect(labels).toContain(drum.name);
  });

  it('aggregates flags from every mod', () => {
    const thermal = MODS.optic_thermal_hud!;
    const piercing = MODS.mag_piercing!;
    const r = resolveWeapon(carbine, [thermal, piercing]);
    expect(r.flags.has('thermal')).toBe(true);
    expect(r.flags.has('piercing')).toBe(true);
  });

  it('floors damage and ammo at sensible minimums', () => {
    // Force an extreme negative dmg mod via a synthetic stack.
    const r = resolveWeapon(carbine, [
      { ...MODS.mag_piercing!, effects: { dmgMin: -99, dmgMax: -99 } },
    ] as any);
    expect(r.effective.dmgMin).toBe(0);
    expect(r.effective.dmgMax).toBeGreaterThanOrEqual(0);
  });

  it('tracks wielder mobility delta from stocks', () => {
    const folding = MODS.stock_folding!;
    const r = resolveWeapon(carbine, [folding]);
    expect(r.mobilityDelta).toBe(1);
  });
});

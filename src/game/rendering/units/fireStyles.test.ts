import { describe, it, expect } from 'vitest';
import { WEAPON_HOLD, FIRE_STYLES } from './fireStyles';
import type { WeaponClass } from '../../types';

/**
 * WEAPON_HOLD: per-class weapon mount profile. Sibling table to
 * FIRE_STYLES — the renderer (UnitNode.ts) reads it at weapon-mount
 * time so each class's grip anchor / scale / muzzle offset / rest pose
 * line up with that weapon's authored SVG geometry.
 *
 * These tests are intentionally about TABLE invariants, not per-class
 * pixel values: a playtest pass tunes the actual numbers in fireStyles.ts.
 * The invariants below pin the property that the table covers every
 * class, that a pistol reads smaller than a rifle, that a heavy reads
 * larger, and that 'default' stays bug-compatible with the legacy
 * single-anchor / 0.42-scale shipping numbers.
 */

const ALL_CLASSES: Array<WeaponClass | 'default'> = [
  'rifle', 'sniper', 'shotgun', 'smg', 'pistol', 'heavy', 'default',
];

describe('WEAPON_HOLD: per-class weapon mount table', () => {
  it('has an entry for every WeaponClass + a default fallback', () => {
    for (const cls of ALL_CLASSES) {
      const hold = WEAPON_HOLD[cls];
      expect(hold, `missing entry for ${cls}`).toBeDefined();
    }
  });

  it.each(ALL_CLASSES)('%s: gripAnchor x/y are valid 0..1 fractions', (cls) => {
    const { gripAnchor } = WEAPON_HOLD[cls];
    expect(gripAnchor.x).toBeGreaterThanOrEqual(0);
    expect(gripAnchor.x).toBeLessThanOrEqual(1);
    expect(gripAnchor.y).toBeGreaterThanOrEqual(0);
    expect(gripAnchor.y).toBeLessThanOrEqual(1);
  });

  it.each(ALL_CLASSES)('%s: scale is a sane sprite multiplier (0..1)', (cls) => {
    const { scale } = WEAPON_HOLD[cls];
    expect(scale).toBeGreaterThan(0);
    expect(scale).toBeLessThan(1);
  });

  it('pistol scale reads noticeably smaller than rifle scale', () => {
    expect(WEAPON_HOLD.pistol.scale).toBeLessThan(WEAPON_HOLD.rifle.scale * 0.85);
  });

  it('heavy scale exceeds rifle scale', () => {
    expect(WEAPON_HOLD.heavy.scale).toBeGreaterThan(WEAPON_HOLD.rifle.scale);
  });

  it('default mirrors the pre-WEAPON_HOLD shipping numbers exactly so the legacy fallback path is bug-compatible', () => {
    expect(WEAPON_HOLD.default.gripAnchor.x).toBe(0.5);
    expect(WEAPON_HOLD.default.gripAnchor.y).toBe(0.56);
    expect(WEAPON_HOLD.default.scale).toBe(0.42);
    // (0.56 - 1) * 128 * 0.42 + 4 = -19.6 — the formula UnitNode used to inline.
    expect(WEAPON_HOLD.default.restY).toBeCloseTo(-19.6, 5);
  });

  it('every class also has a FIRE_STYLES entry — WEAPON_HOLD + FIRE_STYLES cover the same union', () => {
    for (const cls of ALL_CLASSES) {
      expect(FIRE_STYLES[cls], `FIRE_STYLES missing ${cls}`).toBeDefined();
    }
  });
});

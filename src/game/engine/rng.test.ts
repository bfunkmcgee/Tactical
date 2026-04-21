import { describe, it, expect } from 'vitest';
import { makeRng } from './rng';

/**
 * Mulberry32 is small, branchy, and easy to silently break when touching
 * the bit-shifts. Reproducible seeds are load-bearing: every mission
 * calls `makeRng(seed)` and the same seed must produce the same shot
 * resolution across replays / bug reports. If any constant or operator
 * here drifts, these tests flag it immediately.
 */
describe('rng (Mulberry32)', () => {
  it('is deterministic — same seed, same sequence', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    const as = Array.from({ length: 100 }, () => a.next());
    const bs = Array.from({ length: 100 }, () => b.next());
    expect(as).toEqual(bs);
  });

  it('diverges for different seeds', () => {
    const a = makeRng(1).next();
    const b = makeRng(2).next();
    expect(a).not.toBe(b);
  });

  it('next() is always in [0, 1)', () => {
    const r = makeRng(0xDEADBEEF);
    for (let i = 0; i < 2000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int(n) is always in [0, n)', () => {
    const r = makeRng(7);
    for (let i = 0; i < 2000; i++) {
      const v = r.int(10);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(10);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('chance(0) is always false', () => {
    const r = makeRng(123);
    // Sample heavily — 0% should never roll true even across thousands of draws.
    for (let i = 0; i < 2000; i++) expect(r.chance(0)).toBe(false);
  });

  it('chance(100) is always true', () => {
    const r = makeRng(123);
    for (let i = 0; i < 2000; i++) expect(r.chance(100)).toBe(true);
  });

  it('chance distribution is roughly calibrated', () => {
    // Burn 10k rolls at 65% (the base hit chance the combat math assumes)
    // and assert the empirical rate is within a couple of percentage
    // points. Catches gross miscalibration (off-by-100, off-by-power-of-two).
    const r = makeRng(0x5eed);
    let hits = 0;
    const N = 10000;
    for (let i = 0; i < N; i++) if (r.chance(65)) hits++;
    const pct = (hits / N) * 100;
    expect(pct).toBeGreaterThan(62);
    expect(pct).toBeLessThan(68);
  });

  it('seeded >>> 0 normalises negative seeds without diverging', () => {
    // makeRng(seed) does `s = seed >>> 0`. Passing -1 should be the same
    // as passing 0xFFFFFFFF.
    const a = makeRng(-1);
    const b = makeRng(0xFFFFFFFF);
    expect(a.next()).toBe(b.next());
  });
});

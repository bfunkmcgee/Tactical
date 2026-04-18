// Small deterministic RNG (Mulberry32) so missions are reproducible for debugging.

export type RNG = { next: () => number; int: (max: number) => number; chance: (pct: number) => boolean };

export function makeRng(seed: number): RNG {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (max: number) => Math.floor(next() * max),
    chance: (pct: number) => next() * 100 < pct,
  };
}

import { describe, it, expect } from 'vitest';
import { hasLineOfSight, getCoverState, line } from './los';
import type { GridMap, Tile, TileKind } from '../types';

function mkMap(rows: string[]): GridMap {
  const width = rows[0].length, height = rows.length;
  const tiles: Tile[] = [];
  for (const r of rows) {
    for (const ch of r) {
      const kind: TileKind =
        ch === '#' ? 'wall' :
        ch === 'H' ? 'cover_full' :
        ch === 'h' ? 'cover_half' : 'floor';
      tiles.push({ kind });
    }
  }
  return { id: 't', name: 't', width, height, tiles, playerSpawns: [], enemySpawns: [] };
}

describe('line', () => {
  it('includes both endpoints', () => {
    const pts = line({ x: 0, y: 0 }, { x: 3, y: 1 });
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[pts.length - 1]).toEqual({ x: 3, y: 1 });
  });
});

describe('hasLineOfSight', () => {
  it('clear line is visible', () => {
    const m = mkMap(['......', '......']);
    expect(hasLineOfSight(m, { x: 0, y: 0 }, { x: 5, y: 0 })).toBe(true);
  });
  it('wall blocks LOS', () => {
    const m = mkMap([
      '..#...',
      '......',
    ]);
    expect(hasLineOfSight(m, { x: 0, y: 0 }, { x: 5, y: 0 })).toBe(false);
  });
  it('LOS endpoints are not themselves considered blocking', () => {
    // Target is in a cover-full cell; endpoints excluded from blocking.
    const m = mkMap(['....H']);
    expect(hasLineOfSight(m, { x: 0, y: 0 }, { x: 4, y: 0 })).toBe(true);
  });
});

describe('getCoverState', () => {
  it('returns full when cover_full tile is adjacent on shot axis', () => {
    // Row: [., ., H, .]. Target at x=1, shooter at x=3 (east of target).
    // dx = sign(3-1) = +1, so cover candidate is target.x + 1 = 2, which is 'H'.
    const m = mkMap(['..H.']);
    expect(getCoverState(m, { x: 3, y: 0 }, { x: 1, y: 0 })).toBe('full');
  });
  it('half cover produces half', () => {
    const m = mkMap(['.h..']);
    // target at x=2, shooter at x=0 → check tile at target.x-1 = 1, which is 'h'
    expect(getCoverState(m, { x: 0, y: 0 }, { x: 2, y: 0 })).toBe('half');
  });
  it('no cover returns none', () => {
    const m = mkMap(['....']);
    expect(getCoverState(m, { x: 0, y: 0 }, { x: 3, y: 0 })).toBe('none');
  });
});

import { describe, it, expect } from 'vitest';
import { findPath, reachable } from './pathing';
import { keyOf } from './grid';
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

describe('pathing', () => {
  it('returns a straight path on an open grid', () => {
    const m = mkMap(['.....', '.....', '.....']);
    const p = findPath(m, { x: 0, y: 0 }, { x: 4, y: 2 })!;
    expect(p).not.toBeNull();
    expect(p[0]).toEqual({ x: 0, y: 0 });
    expect(p[p.length - 1]).toEqual({ x: 4, y: 2 });
    expect(p.length).toBe(7); // Manhattan 4+2 = 6 steps = 7 nodes
  });

  it('routes around walls', () => {
    const m = mkMap([
      '.....',
      '.###.',
      '.....',
    ]);
    const p = findPath(m, { x: 0, y: 1 }, { x: 4, y: 1 })!;
    expect(p).not.toBeNull();
    // The straight route is blocked — path must bend via y=0 or y=2.
    expect(p.some((n) => n.y !== 1)).toBe(true);
  });

  it('returns null when unreachable', () => {
    const m = mkMap([
      '.#.',
      '.#.',
      '.#.',
    ]);
    expect(findPath(m, { x: 0, y: 1 }, { x: 2, y: 1 })).toBeNull();
  });

  it('reachable flood respects maxSteps', () => {
    const m = mkMap(['.....', '.....', '.....']);
    const r = reachable(m, { x: 2, y: 1 }, 2);
    // Manhattan-distance-2 tiles on a 5x3 grid from (2,1).
    expect(r.get(keyOf(2, 1))).toBe(0);
    expect(r.get(keyOf(4, 1))).toBe(2);
    expect(r.has(keyOf(0, 0))).toBe(false); // distance 3
  });

  it('blocked units cannot be walked through but goal still reachable', () => {
    const m = mkMap(['.....']);
    const p = findPath(m, { x: 0, y: 0 }, { x: 4, y: 0 }, new Set([keyOf(2, 0)]));
    expect(p).toBeNull(); // on a 1-row map, blocking the only path is terminal
  });
});

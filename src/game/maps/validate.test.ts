import { describe, it, expect } from 'vitest';
import { ALL_MAPS } from './index';
import { validateMapReachability } from './validate';
import type { GridMap, Tile } from '../types';

/**
 * Shipping maps must be fully solvable — every enemy spawn must be
 * reachable from at least one player spawn through walkable tiles.
 * This test catches boxed-in spawns that would stall "eliminate all"
 * mission objectives.
 */
describe('map reachability', () => {
  for (const m of ALL_MAPS) {
    it(`${m.id}: every enemy spawn is reachable from a player spawn`, () => {
      expect(validateMapReachability(m)).toEqual([]);
    });
  }

  it('reports enemy spawns fully enclosed by cover_full', () => {
    // Contrived 5×5 map where an enemy sits inside a ring of cover_full.
    const W = 5, H = 5;
    const tiles: Tile[] = new Array(W * H);
    const setKind = (x: number, y: number, kind: Tile['kind']) => {
      tiles[y * W + x] = { kind };
    };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) setKind(x, y, 'floor');
    for (const [x, y] of [[1,1],[2,1],[3,1],[1,2],[3,2],[1,3],[2,3],[3,3]]) {
      setKind(x, y, 'cover_full');
    }
    const bad: GridMap = {
      id: 'test-enclosed', name: 'test', width: W, height: H, tiles,
      playerSpawns: [{ x: 0, y: 0 }],
      enemySpawns: [{ pos: { x: 2, y: 2 }, spawnKey: 'G' }],
    };
    const warnings = validateMapReachability(bad);
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toMatch(/unreachable/);
  });
});

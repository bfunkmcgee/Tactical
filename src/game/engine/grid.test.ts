import { describe, it, expect } from 'vitest';
import { inBounds, tileAt, isWalkable, blocksLos, chebyshev, manhattan, keyOf } from './grid';
import type { GridMap, Tile, TileKind } from '../types';

function mkMap(rows: string[]): GridMap {
  const width = rows[0].length, height = rows.length;
  const tiles: Tile[] = [];
  for (const r of rows) for (const ch of r) {
    const kind: TileKind =
      ch === '#' ? 'wall' :
      ch === 'H' ? 'cover_full' :
      ch === 'h' ? 'cover_half' :
      ch === '~' ? 'hazard' : 'floor';
    tiles.push({ kind });
  }
  return { id: 't', name: 't', width, height, tiles, playerSpawns: [], enemySpawns: [] };
}

describe('grid helpers', () => {
  describe('inBounds', () => {
    const m = mkMap(['....', '....', '....']); // 4×3

    it('is true for coordinates inside the map', () => {
      expect(inBounds(m, 0, 0)).toBe(true);
      expect(inBounds(m, 3, 2)).toBe(true);
      expect(inBounds(m, 1, 1)).toBe(true);
    });

    it('is false on any out-of-bounds coordinate', () => {
      expect(inBounds(m, -1, 0)).toBe(false);
      expect(inBounds(m, 0, -1)).toBe(false);
      expect(inBounds(m, 4, 0)).toBe(false);  // one past right edge
      expect(inBounds(m, 0, 3)).toBe(false);  // one past bottom edge
      expect(inBounds(m, 99, 99)).toBe(false);
    });
  });

  describe('tileAt', () => {
    it('returns null for OOB coords and the tile otherwise', () => {
      const m = mkMap(['.#h', 'H.~']);
      expect(tileAt(m, -1, 0)).toBeNull();
      expect(tileAt(m, 3, 0)).toBeNull();
      expect(tileAt(m, 0, 0)?.kind).toBe('floor');
      expect(tileAt(m, 1, 0)?.kind).toBe('wall');
      expect(tileAt(m, 2, 0)?.kind).toBe('cover_half');
      expect(tileAt(m, 0, 1)?.kind).toBe('cover_full');
      expect(tileAt(m, 2, 1)?.kind).toBe('hazard');
    });
  });

  describe('isWalkable', () => {
    const m = mkMap(['.#hH~']);

    it('accepts floor + half cover + hazard, rejects wall + full cover', () => {
      expect(isWalkable(m, 0, 0)).toBe(true);  // floor
      expect(isWalkable(m, 1, 0)).toBe(false); // wall
      expect(isWalkable(m, 2, 0)).toBe(true);  // cover_half
      expect(isWalkable(m, 3, 0)).toBe(false); // cover_full
      expect(isWalkable(m, 4, 0)).toBe(true);  // hazard — still walkable
    });

    it('is false for out-of-bounds coords', () => {
      expect(isWalkable(m, -1, 0)).toBe(false);
      expect(isWalkable(m, 99, 0)).toBe(false);
      expect(isWalkable(m, 0, 1)).toBe(false);
    });
  });

  describe('blocksLos', () => {
    const m = mkMap(['.#hH']);

    it('only blocks on wall + cover_full (half-cover lets the round through)', () => {
      expect(blocksLos(m, 0, 0)).toBe(false); // floor — doesn't block
      expect(blocksLos(m, 1, 0)).toBe(true);  // wall
      expect(blocksLos(m, 2, 0)).toBe(false); // half cover — doesn't block LOS
      expect(blocksLos(m, 3, 0)).toBe(true);  // full cover
    });

    it('is true for out-of-bounds (edge of map acts as a wall)', () => {
      // Asymmetric with isWalkable on purpose: stepping off the map is
      // blocked in both directions, but LOS leaves the map "walled".
      expect(blocksLos(m, -1, 0)).toBe(true);
      expect(blocksLos(m, 99, 0)).toBe(true);
    });
  });

  describe('distance helpers', () => {
    it('chebyshev is the max of |dx| and |dy|', () => {
      expect(chebyshev({ x: 0, y: 0 }, { x: 3, y: 1 })).toBe(3);
      expect(chebyshev({ x: 0, y: 0 }, { x: 2, y: 5 })).toBe(5);
      expect(chebyshev({ x: 4, y: 4 }, { x: 4, y: 4 })).toBe(0);
      expect(chebyshev({ x: -1, y: -2 }, { x: 3, y: 1 })).toBe(4);
    });

    it('manhattan is |dx|+|dy|', () => {
      expect(manhattan({ x: 0, y: 0 }, { x: 3, y: 1 })).toBe(4);
      expect(manhattan({ x: 2, y: 2 }, { x: 2, y: 2 })).toBe(0);
      expect(manhattan({ x: -1, y: 0 }, { x: 1, y: 0 })).toBe(2);
    });
  });

  describe('keyOf', () => {
    it('is injective within the supported map range (width < 4096)', () => {
      // Exercise the corners and a dense mid-region of a 4095×4095
      // virtual map. Any collision in this range would silently break
      // path-finding and reachability sets.
      const seen = new Map<number, [number, number]>();
      const points: Array<[number, number]> = [
        [0, 0], [4095, 0], [0, 4095], [4095, 4095],
        [1, 1], [4094, 4094],
      ];
      for (let i = 0; i < 400; i++) {
        points.push([(i * 31) % 4096, (i * 17) % 4096]);
      }
      for (const [x, y] of points) {
        const k = keyOf(x, y);
        const prev = seen.get(k);
        if (prev && (prev[0] !== x || prev[1] !== y)) {
          throw new Error(`keyOf collision: (${x},${y}) and (${prev[0]},${prev[1]}) both → ${k}`);
        }
        seen.set(k, [x, y]);
      }
      expect(seen.size).toBeGreaterThanOrEqual(points.length - 2); // allow for intentional dupes
    });

    it('encoding/decoding round-trips via the modulus the renderer uses', () => {
      // PixiStage decodes back via `x = k % 4096, y = floor(k / 4096)`.
      // If keyOf's formula diverges, overlays + reach sets render at the
      // wrong tiles.
      for (const [x, y] of [[0, 0], [15, 11], [4095, 4095]] as const) {
        const k = keyOf(x, y);
        expect(k % 4096).toBe(x);
        expect(Math.floor(k / 4096)).toBe(y);
      }
    });

    it('collides outside the supported range — a canary for oversized maps', () => {
      // keyOf(0, 1) === keyOf(4096, 0). We never ship a map wider than
      // 4096 tiles, but if anyone tries, pathing will silently break.
      // This test locks in the current limit so a future change forces
      // a conscious decision about widening the key space.
      expect(keyOf(4096, 0)).toBe(keyOf(0, 1));
    });
  });
});

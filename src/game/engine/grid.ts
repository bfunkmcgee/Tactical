import type { GridMap, Tile, Vec2 } from '../types';

export const inBounds = (m: GridMap, x: number, y: number) =>
  x >= 0 && y >= 0 && x < m.width && y < m.height;

export const tileAt = (m: GridMap, x: number, y: number): Tile | null =>
  inBounds(m, x, y) ? m.tiles[y * m.width + x] : null;

export const isWalkable = (m: GridMap, x: number, y: number): boolean => {
  const t = tileAt(m, x, y);
  if (!t) return false;
  return t.kind !== 'wall' && t.kind !== 'cover_full';
};

export const blocksLos = (m: GridMap, x: number, y: number): boolean => {
  const t = tileAt(m, x, y);
  if (!t) return true;
  return t.kind === 'wall' || t.kind === 'cover_full';
};

export const chebyshev = (a: Vec2, b: Vec2) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
export const manhattan = (a: Vec2, b: Vec2) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export const keyOf = (x: number, y: number) => y * 4096 + x;

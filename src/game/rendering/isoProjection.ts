import type { Vec2 } from '../types';

export const TILE_W = 64;
export const TILE_H = 32;

/** Grid tile center -> screen coord (before camera transform). */
export function gridToScreen(g: Vec2) {
  return {
    x: (g.x - g.y) * (TILE_W / 2),
    y: (g.x + g.y) * (TILE_H / 2),
  };
}

/** Screen coord (before camera) -> nearest grid tile. */
export function screenToGrid(s: Vec2): Vec2 {
  const gx = s.x / (TILE_W / 2);
  const gy = s.y / (TILE_H / 2);
  return {
    x: Math.round((gx + gy) / 2),
    y: Math.round((gy - gx) / 2),
  };
}

import type { Graphics, Texture } from 'pixi.js';
import type { GridMap } from '../types';
import { TILE_W, TILE_H } from './isoProjection';

/**
 * Shared primitives used by every sub-renderer: palette shape, the per-tile
 * diamond, a brightness shift utility, and the sprite texture cache.
 */

/** Texture cache keyed by `${templateId}:body` | `:arms` | `:weapon` | `w:${weaponId}`. */
export const spriteCache = new Map<string, Texture>();

/**
 * Small prop / decal draw signature. Every biome defines pools of these for
 * floor decals, env props, and edge bumps.
 */
export type PropDraw = (g: Graphics, cx: number, cy: number) => void;

/**
 * Tile palette per biome — fills for every tile kind plus the stroke colors
 * used on the diamond outline and the raised cover rectangles.
 */
export type TilePalette = {
  floor: readonly [number, number, number]; // three variants for floor mottle
  floorStroke: number;
  wall: number;
  wallHighlight: number;      // top rim of walls (sun-hit edge).
  wallStain: number;          // weathering drip color.
  halfCover: number;
  fullCover: number;
  coverHighlight: number;     // top rim of raised cover.
  coverShade: number;         // shaded right side of raised cover.
  coverStroke: number;
  accent: number;             // pebble flecks / brick seams.
  accentLight: number;        // highlight flecks / chips of pale sand.
  rimHighlight: number;       // NE edge of floor diamonds (sun hint).
};

/** Render context threaded through ground + cover passes. */
export type RenderContext = {
  g: Graphics;
  pal: TilePalette;
  map: GridMap;
};

/** Iso-diamond tile at (cx, cy) — tiles, overlays, smoke. */
export function diamond(
  g: Graphics, cx: number, cy: number, fill: number, alpha: number, stroke?: number,
) {
  g.moveTo(cx, cy - TILE_H / 2);
  g.lineTo(cx + TILE_W / 2, cy);
  g.lineTo(cx, cy + TILE_H / 2);
  g.lineTo(cx - TILE_W / 2, cy);
  g.closePath();
  g.fill({ color: fill, alpha });
  // Stronger tile outline (alpha 0.75) lets diamonds carry the same
  // mark-making weight as the sprite silhouettes above them.
  if (stroke !== undefined) g.stroke({ color: stroke, width: 1, alpha: 0.75 });
}

/**
 * Shift a 24-bit RGB color by ±pct (0..100) toward white or black.
 * Used per tile so a grid of cover blocks looks hand-placed instead
 * of die-stamped.
 */
export function shiftBrightness(color: number, pct: number): number {
  const r = (color >> 16) & 0xff, g = (color >> 8) & 0xff, b = color & 0xff;
  const k = pct / 100;
  const adj = (c: number) => {
    const v = k >= 0 ? c + (255 - c) * k : c + c * k;
    return Math.max(0, Math.min(255, Math.round(v)));
  };
  return (adj(r) << 16) | (adj(g) << 8) | adj(b);
}

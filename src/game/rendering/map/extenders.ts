import type { Graphics } from 'pixi.js';
import { TILE_H } from '../isoProjection';

/**
 * Cover connection primitives. When two cover tiles sit on adjacent
 * grid squares there is a 4-px-wide, 16-px-tall (half TILE_H) sliver
 * of empty space in between them in screen coords. These helpers fill
 * that gap with a slanted ribbon so the two blocks read as one
 * continuous wall instead of floating islands.
 *
 * N / W neighbours' extenders get drawn by THOSE tiles (looping toward
 * us), so drawMap only calls the E / S variants to cover every junction.
 */

/**
 * East-extender: bridges toward the cover tile at grid (x+1, y). That
 * neighbour sits down-right in screen space, so the ribbon slants NW→SE.
 */
export function drawEastExtender(
  g: Graphics, px: number, py: number, h: number,
  fill: number, stroke: number,
) {
  const H = TILE_H / 2;      // 16 — vertical stagger per grid step
  g.poly([
    px + 14, py - h,            // top-left (this block's NE top corner)
    px + 18, py + H - h,        // top-right (neighbour's NW top corner)
    px + 18, py + H,            // bottom-right (neighbour's NW base)
    px + 14, py,                // bottom-left (this block's E base)
  ]).fill({ color: fill, alpha: 0.95 });
  // Top-edge sun highlight carries across the ribbon.
  g.moveTo(px + 14, py - h);
  g.lineTo(px + 18, py + H - h);
  g.stroke({ color: 0xffffff, width: 0.6, alpha: 0.25 });
  // Subtle dark seam at the join so you can still read the tile
  // boundary if you're looking for it — but the silhouette stays
  // continuous.
  g.moveTo(px + 14, py);
  g.lineTo(px + 18, py + H);
  g.stroke({ color: stroke, width: 0.6, alpha: 0.5 });
}

/**
 * South-extender: bridges toward the cover tile at grid (x, y+1). That
 * neighbour sits down-LEFT in screen space, so the ribbon slants NE→SW.
 */
export function drawSouthExtender(
  g: Graphics, px: number, py: number, h: number,
  fill: number, stroke: number,
) {
  const H = TILE_H / 2;
  g.poly([
    px - 14, py - h,
    px - 18, py + H - h,
    px - 18, py + H,
    px - 14, py,
  ]).fill({ color: fill, alpha: 0.95 });
  g.moveTo(px - 14, py - h);
  g.lineTo(px - 18, py + H - h);
  g.stroke({ color: 0xffffff, width: 0.6, alpha: 0.2 });
  g.moveTo(px - 14, py);
  g.lineTo(px - 18, py + H);
  g.stroke({ color: stroke, width: 0.6, alpha: 0.5 });
}

/**
 * Draw a cover_half block with a jagged broken-top silhouette. The
 * notch position is seeded from the tile hash so the same tile always
 * breaks the same way across redraws. Used only for fully isolated
 * half-cover blocks — a middle-of-a-wall block with a V-notch would
 * look wrong next to its connected neighbours.
 */
export function drawBrokenCoverShape(
  g: Graphics, px: number, py: number, h: number,
  tileHash: number, fill: number, stroke: number,
) {
  const left = px - 14, right = px + 14, top = py - h, bot = py;
  const topLeft = left + 2, topRight = right - 2;
  const notchStart = topLeft + 3 + ((tileHash >>> 20) % 8);
  const notchW = 8;
  const notchDepth = 6;
  // Jagged V with a central hump so the notch doesn't look like a
  // perfect triangular cut.
  g.poly([
    left, bot,
    topLeft, top,
    notchStart,          top,
    notchStart + notchW * 0.3, top + notchDepth,
    notchStart + notchW * 0.55, top + notchDepth - 2,
    notchStart + notchW * 0.7, top + notchDepth,
    notchStart + notchW, top,
    topRight, top,
    right, bot,
  ]).fill({ color: fill, alpha: 0.95 }).stroke({ color: stroke, width: 1 });
  // Three rubble dots nestled into the notch — a pile of debris.
  const baseX = notchStart + notchW / 2;
  const baseY = top + notchDepth;
  g.circle(baseX - 1.5, baseY + 0.4, 1.2).fill({ color: stroke, alpha: 0.85 });
  g.circle(baseX + 1.3, baseY - 0.2, 1.0).fill({ color: stroke, alpha: 0.75 });
  g.circle(baseX,       baseY - 1.6, 0.8).fill({ color: stroke, alpha: 0.6 });
}

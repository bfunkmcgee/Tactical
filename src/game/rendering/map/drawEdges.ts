import type { Graphics } from 'pixi.js';
import type { GridMap } from '../../types';
import { TILE_W, TILE_H } from '../isoProjection';
import { shiftBrightness, type PropDraw, type TilePalette } from '../context';
import { biomeFor } from '../biomes';

/**
 * Edge feathering — draws a ring of biome-appropriate silhouette
 * outside the map's tile grid so the battlefield stops hard-stopping
 * in space. Desert biomes feather into dune crests; the refinery
 * biome feathers into a jagged sheet-metal ruin line. Deterministic
 * from (x, y) so the outline is stable across redraws.
 *
 * The effect is drawn in a narrow band that extends ~2 iso tiles
 * past the wall-ring, fading with alpha toward the outer edge.
 */
export function drawMapEdges(g: Graphics, map: GridMap, pal: TilePalette) {
  // Outer silhouette tint: slightly darker + warmer than the floor
  // palette so the ring reads as "background fill" not "more map."
  const base = shiftBrightness(pal.floor[2], -35);
  const outline = pal.floorStroke;

  // Iso-space band definitions. Iso bounds of the tile grid are:
  //   xIso(x,y) = (x - y) * TILE_W / 2
  //   yIso(x,y) = (x + y) * TILE_H / 2
  const W = map.width, H = map.height;
  const half = TILE_W / 2, halfH = TILE_H / 2;
  const north = { x: (0 - 0) * half, y: (0 + 0) * halfH };
  const east  = { x: (W - 0) * half, y: (W + 0) * halfH };
  const south = { x: (W - H) * half, y: (W + H) * halfH };
  const west  = { x: (0 - H) * half, y: (0 + H) * halfH };

  // Draw the "beyond" fill as an expanded diamond with a feathered
  // dark ring. Two concentric fills — faint outer, stronger inner.
  const outerPad = 64, innerPad = 24;
  const expand = (p: { x: number; y: number }, pad: number,
                  dir: { x: number; y: number }) =>
    ({ x: p.x + dir.x * pad, y: p.y + dir.y * pad });
  const outerRing = [
    expand(north, outerPad, { x: 0, y: -1 }),
    expand(east,  outerPad, { x: 1,  y: 0 }),
    expand(south, outerPad, { x: 0,  y: 1 }),
    expand(west,  outerPad, { x: -1, y: 0 }),
  ];
  const innerRing = [
    expand(north, innerPad, { x: 0, y: -1 }),
    expand(east,  innerPad, { x: 1,  y: 0 }),
    expand(south, innerPad, { x: 0,  y: 1 }),
    expand(west,  innerPad, { x: -1, y: 0 }),
  ];
  // Outer darkening fill — a big diamond that surrounds the play area.
  g.poly([
    outerRing[0].x, outerRing[0].y,
    outerRing[1].x, outerRing[1].y,
    outerRing[2].x, outerRing[2].y,
    outerRing[3].x, outerRing[3].y,
  ]).fill({ color: base, alpha: 0.55 });
  // Inner brighter ring so the transition reads as a dusty halo.
  g.poly([
    innerRing[0].x, innerRing[0].y,
    innerRing[1].x, innerRing[1].y,
    innerRing[2].x, innerRing[2].y,
    innerRing[3].x, innerRing[3].y,
  ]).fill({ color: base, alpha: 0.9 });

  // Biome-specific silhouette bumps along each of the four iso edges.
  const bumps: PropDraw[] = biomeFor(map.tileset).edgePool;
  if (bumps.length > 0) {
    // Place ~14 bumps evenly along the 4 diamond edges. Seed from
    // (W, H) so identical maps get identical bump layouts.
    const seed = (W * 73856093 ^ H * 19349663) >>> 0;
    const rand = (salt: number) => ((seed + salt * 2654435761) >>> 0) / 0xffffffff;
    const edges: Array<[typeof north, typeof north]> = [
      [west, north], [north, east], [east, south], [south, west],
    ];
    let i = 0;
    for (const [a, b] of edges) {
      for (let k = 1; k < 4; k++, i++) {
        const t = k / 4 + (rand(i) * 0.2 - 0.1);
        // Offset outward from the diamond edge by ~28px perpendicular.
        const ex = a.x + (b.x - a.x) * t;
        const ey = a.y + (b.y - a.y) * t;
        // Outward normal: perpendicular to (b-a), pointing away from centre.
        const dx = b.x - a.x, dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = dy / len, ny = -dx / len;
        // Ensure outward direction (away from map centre).
        const cx = (east.x + west.x) / 2, cy = (north.y + south.y) / 2;
        const sign = (ex - cx) * nx + (ey - cy) * ny > 0 ? 1 : -1;
        const ox = ex + nx * sign * 28, oy = ey + ny * sign * 28;
        const pick = bumps[(seed >>> (i * 2)) % bumps.length];
        pick(g, ox, oy);
      }
    }
  }
  // A gentle outline along the inner ring — same stroke colour as
  // the tile diamonds — so the play field feels deliberately bounded.
  g.moveTo(innerRing[0].x, innerRing[0].y);
  g.lineTo(innerRing[1].x, innerRing[1].y);
  g.lineTo(innerRing[2].x, innerRing[2].y);
  g.lineTo(innerRing[3].x, innerRing[3].y);
  g.closePath();
  g.stroke({ color: outline, width: 1.5, alpha: 0.45 });
}

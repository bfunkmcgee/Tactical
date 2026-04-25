import { Container, Graphics } from 'pixi.js';
import type { GridMap, TileKind } from '../../types';
import { tileAt } from '../../engine/grid';
import { gridToScreen, TILE_H, TILE_W } from '../isoProjection';
import { diamond, shiftBrightness } from '../context';
import { biomeFor } from '../biomes';
import { drawMapEdges } from './drawEdges';
import { drawEnvProps } from './drawProps';
import { drawFloorDecals } from './drawDecals';
import { drawEastExtender, drawSouthExtender, drawBrokenCoverShape } from './extenders';

/**
 * Universal painted-light pass: layer a lighter NE half (sun-cast) +
 * darker SW half (shadow) on top of every flat-fill iso diamond. Cheap
 * (two extra polys per tile, all in one batched Graphics) but gives
 * each tile a dimensional read instead of the flat solid-fill stamp
 * the procedural renderer used to ship.
 *
 * Iso diamond corners around (cx, cy) — N (top), E (right), S
 * (bottom), W (left). The split runs along the W↔E line; the top
 * triangle is the sun-cast, bottom is the shadow.
 */
function paintTileLight(g: Graphics, cx: number, cy: number, fill: number) {
  const halfW = TILE_W / 2, halfH = TILE_H / 2;
  // Sun-cast top triangle.
  g.poly([cx, cy - halfH, cx + halfW, cy, cx - halfW, cy])
    .fill({ color: shiftBrightness(fill, 14), alpha: 0.42 });
  // Shadow bottom triangle.
  g.poly([cx, cy + halfH, cx - halfW, cy, cx + halfW, cy])
    .fill({ color: shiftBrightness(fill, -22), alpha: 0.36 });
}

/**
 * Per-edge geometry table for the edge-blend pass. Each entry gives
 * the diamond edge's two endpoints (relative to tile center) plus the
 * inward unit-normal. Multiplied by `EDGE_BAND_PX` to inset the band.
 *
 * Edge naming follows the diamond corner the band STARTS at — NE goes
 * from the top corner clockwise to the right corner, etc. The inward
 * normal points from the edge midpoint toward the tile center.
 */
const EDGE_BAND_PX = 6;
const _hw = TILE_W / 2, _hh = TILE_H / 2;
const _len = Math.hypot(_hw, _hh);
type EdgeKey = 'NE' | 'SE' | 'SW' | 'NW';
const EDGES: Record<EdgeKey, {
  ax: number; ay: number; bx: number; by: number; nx: number; ny: number;
}> = {
  NE: { ax: 0,    ay: -_hh, bx: _hw,  by: 0,    nx: -_hh / _len, ny:  _hw / _len },
  SE: { ax: _hw,  ay: 0,    bx: 0,    by: _hh,  nx: -_hh / _len, ny: -_hw / _len },
  SW: { ax: 0,    ay: _hh,  bx: -_hw, by: 0,    nx:  _hh / _len, ny: -_hw / _len },
  NW: { ax: -_hw, ay: 0,    bx: 0,    by: -_hh, nx:  _hh / _len, ny:  _hw / _len },
};

/**
 * Build a thin parallelogram strip on the inside of the named diamond
 * edge. The strip's outer side traces the edge exactly; the inner side
 * sits `EDGE_BAND_PX` toward the tile centre. Filled with the
 * neighbour's colour at low alpha by `drawEdgeBlend`, this softens the
 * hard diamond seam between adjacent tiles of different kinds.
 */
function edgeBandPoly(cx: number, cy: number, edge: EdgeKey): number[] {
  const e = EDGES[edge];
  const ix = e.nx * EDGE_BAND_PX, iy = e.ny * EDGE_BAND_PX;
  return [
    cx + e.ax,      cy + e.ay,
    cx + e.bx,      cy + e.by,
    cx + e.bx + ix, cy + e.by + iy,
    cx + e.ax + ix, cy + e.ay + iy,
  ];
}

/**
 * Resolve the base fill for a tile of the given kind in the active
 * palette. Floor uses the variant; cover/wall ignore variant. Used by
 * the edge-blend pass to pick up the neighbour's colour.
 */
function fillForKind(
  kind: TileKind, variant: number,
  pal: { floor: readonly [number, number, number]; wall: number; halfCover: number; fullCover: number },
): number {
  if (kind === 'floor') return pal.floor[variant];
  if (kind === 'wall') return pal.wall;
  if (kind === 'cover_half') return pal.halfCover;
  if (kind === 'cover_full') return pal.fullCover;
  return pal.floor[0];
}

/**
 * Paint the full tile layer. Called on mission init and whenever the map
 * reference changes (grenades / demolish swap it). Draws in order:
 *   1. Edge feathering (biome silhouette beyond the tile grid)
 *   2. Tile loop: floor / wall / cover diamonds + universal sun-cast
 *      + biome detail + edge-blend ribbons + cover silhouettes
 *   3. Floor decals (lane-biased pass)
 *   4. Env props (density-biased pass)
 */
export function drawMap(layer: Container, map: GridMap) {
  layer.removeChildren();
  const biome = biomeFor(map.tileset);
  const pal = biome.palette;
  const g = new Graphics();

  drawMapEdges(g, map, pal);

  // Pre-compute cover connectivity so each block knows which grid-
  // neighbours are also cover. Used by the extender ribbons to extend
  // the silhouette into adjacent tiles instead of rendering as an
  // island.
  const isCover = (tx: number, ty: number): boolean => {
    const tt = tileAt(map, tx, ty);
    return !!tt && (tt.kind === 'cover_half' || tt.kind === 'cover_full');
  };

  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const t = tileAt(map, x, y)!;
      const p = gridToScreen({ x, y });
      // Tile variant is computed from a real hash so the map doesn't
      // stripe diagonally (the old (x*5 + y*13) % 3 formula produced
      // visible NE→SW tonal bands across every map).
      const tileHash = ((x * 73856093) ^ (y * 19349663)) >>> 0;
      const variant = tileHash % 3;
      const fill = fillForKind(t.kind, variant, pal);
      diamond(g, p.x, p.y, fill, 1, pal.floorStroke);
      // Universal painted-light pass: sun-cast top + shadow bottom.
      // Applied to every floor + ground-plane cover tile so the iso
      // grid reads as a real 3D plane, not a flat decorated quad.
      paintTileLight(g, p.x, p.y, fill);
      // Biome-specific detail pass on the ground-plane diamond.
      biome.drawGroundDetail?.(g, t.kind, variant, p.x, p.y, x, y, pal);

      // Edge-blend pass: when a grid neighbour has a different kind,
      // bleed its colour 6 px into this tile along the shared diamond
      // edge. The neighbour does the symmetric blend on its own side
      // so the boundary fades from each direction — soft transition
      // instead of a hard diamond seam where, say, a sand floor meets
      // a clay-brick cover or an adobe wall.
      //
      // Grid → screen-edge map (iso projection):
      //   (x+1, y)  → SE     (x, y+1) → SW
      //   (x-1, y)  → NW     (x, y-1) → NE
      const blendIfDifferent = (edge: EdgeKey, nx: number, ny: number) => {
        const nt = tileAt(map, nx, ny);
        if (!nt || nt.kind === t.kind) return;
        const nHash = ((nx * 73856093) ^ (ny * 19349663)) >>> 0;
        const nFill = fillForKind(nt.kind, nHash % 3, pal);
        if (nFill === fill) return;
        g.poly(edgeBandPoly(p.x, p.y, edge))
          .fill({ color: nFill, alpha: 0.32 });
      };
      blendIfDifferent('SE', x + 1, y);
      blendIfDifferent('SW', x,     y + 1);
      blendIfDifferent('NW', x - 1, y);
      blendIfDifferent('NE', x,     y - 1);

      if (t.kind === 'cover_half' || t.kind === 'cover_full') {
        const h = t.kind === 'cover_full' ? 22 : 12;
        const nE = isCover(x + 1, y);
        const nS = isCover(x, y + 1);
        const nW = isCover(x - 1, y);
        const nN = isCover(x, y - 1);
        const connected = nE || nS || nW || nN;

        // Cast shadow: full strength for standalone blocks, dimmed for
        // the interior of a connected wall so you don't see a zebra of
        // shadow pools under one continuous structure.
        const shadowAlpha = (nE && nS) ? 0.12 : (nE || nS) ? 0.22 : 0.35;
        g.ellipse(p.x - 5, p.y + 5, 17, 5)
          .fill({ color: 0x000000, alpha: shadowAlpha });

        if (biome.drawCover) {
          // Biome-provided custom cover silhouette (e.g. refinery pipes/tanks).
          biome.drawCover(g, t.kind, p.x, p.y, h, pal);
        } else {
          // Per-tile fill variance so adjacent blocks don't look
          // stamped from the same die.
          const variance = ((tileHash >>> 4) % 41) - 20;
          const tintedFill = shiftBrightness(fill, variance);

          // When a grid-E / grid-S neighbour is also cover, bridge the
          // 4px + 16-stagger gap with an extender parallelogram so the
          // two blocks read as one continuous wall instead of floating
          // islands. N / W neighbours' extenders get drawn by THOSE
          // tiles (looping toward us) so we cover every connection.
          if (nE) drawEastExtender(g, p.x, p.y, h, tintedFill, pal.coverStroke);
          if (nS) drawSouthExtender(g, p.x, p.y, h, tintedFill, pal.coverStroke);

          // Broken-top silhouette is ONLY used for fully isolated
          // blocks — a middle-of-a-wall block with a V-notch would
          // look wrong next to its connected neighbours.
          const broken = !connected && t.kind === 'cover_half'
            && ((tileHash >>> 12) % 10) < 4;
          if (broken) {
            drawBrokenCoverShape(g, p.x, p.y, h, tileHash, tintedFill, pal.coverStroke);
          } else {
            // Trapezoid silhouette with a slight inward batter at the
            // top (2px per side). Desert masonry tapers; rectangles
            // read as wooden crates.
            g.poly([
              p.x - 14,     p.y,
              p.x - 14 + 2, p.y - h,
              p.x + 14 - 2, p.y - h,
              p.x + 14,     p.y,
            ]).fill({ color: tintedFill, alpha: 0.95 })
              .stroke({ color: pal.coverStroke, width: 1 });
          }
          biome.drawCoverDetail?.(g, t.kind, p.x, p.y, h, x, y, pal);
        }
      }
    }
  }
  drawFloorDecals(g, map);
  drawEnvProps(g, map);
  layer.addChild(g);
}

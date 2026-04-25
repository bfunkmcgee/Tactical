import type { Graphics } from 'pixi.js';
import type { TileKind } from '../../types';
import { TILE_W, TILE_H } from '../isoProjection';
import type { PropDraw, TilePalette } from '../context';

/**
 * Desert biome: warm dune palette, adobe masonry walls, clay-brick half
 * cover, sandstone column full cover. Props/decals/edges evoke a sun-
 * bleached battlefield.
 */
// --- Painted floor textures (Phase: first painted assets) ----------
//
// Six painted iso-diamond sand variants under
// public/styles/flat/biomes/desert/floor_{0..5}.png. drawMap mounts
// one of these as a Sprite per floor tile, picked deterministically
// from the tile hash. When the texture isn't loaded (preload race or
// missing file), drawMap falls back to the procedural diamond + grain
// path automatically — same biome, same palette.
//
// Source PNGs ship at 480×240 (iso 2:1 aspect); the renderer scales
// them to the in-game TILE_W × TILE_H = 64 × 32 footprint.
export const DESERT_PAINTED_FLOORS: ReadonlyArray<{ cacheKey: string; url: string }> = [
  { cacheKey: 'painted:desert:floor:0', url: '/styles/flat/biomes/desert/floor_0.png' },
  { cacheKey: 'painted:desert:floor:1', url: '/styles/flat/biomes/desert/floor_1.png' },
  { cacheKey: 'painted:desert:floor:2', url: '/styles/flat/biomes/desert/floor_2.png' },
  { cacheKey: 'painted:desert:floor:3', url: '/styles/flat/biomes/desert/floor_3.png' },
  { cacheKey: 'painted:desert:floor:4', url: '/styles/flat/biomes/desert/floor_4.png' },
  { cacheKey: 'painted:desert:floor:5', url: '/styles/flat/biomes/desert/floor_5.png' },
];

export const DESERT_PALETTE: TilePalette = {
  floor: [0xd4b37a, 0xc3a066, 0xb18850], // pale dune / sand / ochre patch
  floorStroke: 0x7a5c30,
  wall: 0x4a3520,                         // weathered adobe
  wallHighlight: 0x8a6838,                // sun-hit top ridge of adobe
  wallStain: 0x2a1a0a,                    // dark weathering drips
  halfCover: 0x8a5a2e,                    // dark clay-brick (deeper + earthier)
  fullCover: 0xd9b074,                    // pale sandstone column (bright + cool)
  coverHighlight: 0xe8c488,               // gold-lit top surface
  coverShade: 0x704a20,                   // shaded right side
  coverStroke: 0x3a2814,
  accent: 0x6a4a22,                       // dark pebble / crack
  accentLight: 0xe8c488,                  // pale chip / bleached highlight
  rimHighlight: 0xe0c089,                 // golden sunlit NE edge
};

// --- Desert props ---------------------------------------------------

const drawDesertBones: PropDraw = (g, cx, cy) => {
  const bone = 0xe4d8b0, dark = 0x3a2a1c;
  // Femur — longer + thicker than the old scatter so it reads at tile zoom.
  g.moveTo(cx - 7, cy + 1); g.lineTo(cx + 7, cy - 3);
  g.stroke({ color: bone, width: 2.2 });
  // Crossed rib.
  g.moveTo(cx - 4, cy - 3); g.lineTo(cx + 3, cy + 3);
  g.stroke({ color: bone, width: 1.5 });
  // Knuckle knobs at each end of the femur.
  g.circle(cx - 7, cy + 1, 1.4).fill({ color: bone });
  g.circle(cx + 7, cy - 3, 1.4).fill({ color: bone });
  g.circle(cx + 7, cy - 3, 0.7).fill({ color: dark, alpha: 0.8 });
};

const drawDesertSignpost: PropDraw = (g, cx, cy) => {
  const wood = 0x6a4828, dark = 0x2a1a0a, gold = 0xe8c488;
  g.rect(cx - 0.7, cy - 11, 1.5, 14).fill({ color: wood, alpha: 0.95 });
  g.poly([
    cx - 6, cy - 12,
    cx + 6, cy - 13,
    cx + 6, cy - 9,
    cx - 6, cy - 8,
  ]).fill({ color: wood }).stroke({ color: dark, width: 0.7 });
  g.moveTo(cx - 6, cy - 12); g.lineTo(cx + 6, cy - 13);
  g.stroke({ color: gold, width: 0.8, alpha: 0.75 });
};

const drawDesertCactus: PropDraw = (g, cx, cy) => {
  const green = 0x567a3a, darker = 0x2a3a18, spine = 0xd8cfa0;
  const highlight = 0x7aa05a;  // sun-hit lighter green
  // Trunk + arms: paint the base shape, then a thin highlight stripe
  // along the NE face of each segment for sun direction consistency.
  g.roundRect(cx - 1.4, cy - 12, 3, 14, 1.4).fill({ color: green }).stroke({ color: darker, width: 0.7 });
  g.rect(cx - 1.4, cy - 12, 0.7, 14).fill({ color: highlight, alpha: 0.6 });
  g.roundRect(cx - 4.6, cy - 7, 2.8, 4, 1.3).fill({ color: green }).stroke({ color: darker, width: 0.5 });
  g.roundRect(cx - 4.8, cy - 10, 1.1, 3.5, 0.5).fill({ color: green });
  g.rect(cx - 4.8, cy - 10, 0.4, 3.5).fill({ color: highlight, alpha: 0.55 });
  g.roundRect(cx + 1.6, cy - 8, 2.8, 4, 1.3).fill({ color: green }).stroke({ color: darker, width: 0.5 });
  g.roundRect(cx + 3.6, cy - 11, 1.1, 3.5, 0.5).fill({ color: green });
  g.rect(cx + 3.6, cy - 11, 0.4, 3.5).fill({ color: highlight, alpha: 0.55 });
  for (const sy of [-9, -5, -1]) g.circle(cx, cy + sy, 0.5).fill({ color: spine, alpha: 0.85 });
};

const drawDesertRag: PropDraw = (g, cx, cy) => {
  const cloth = 0xa86848, dark = 0x4a2818;
  g.poly([
    cx - 7, cy + 2,
    cx - 3, cy - 3,
    cx + 1, cy - 1,
    cx + 4, cy - 4,
    cx + 7, cy + 1,
    cx + 5, cy + 3,
    cx, cy + 1,
    cx - 4, cy + 3,
  ]).fill({ color: cloth });
  g.moveTo(cx - 7, cy + 2);
  g.quadraticCurveTo(cx, cy - 3, cx + 7, cy + 1);
  g.stroke({ color: dark, width: 0.6, alpha: 0.8 });
};

const drawDesertGrass: PropDraw = (g, cx, cy) => {
  const straw = 0xc8a862, darker = 0x6a4a22;
  g.ellipse(cx, cy + 2, 3, 0.8).fill({ color: darker, alpha: 0.7 });
  for (const [dx, dy] of [[-3, -5], [-1.5, -7], [0, -8], [1, -6.5], [2.5, -7], [3.5, -4]] as const) {
    g.moveTo(cx, cy + 2);
    g.lineTo(cx + dx, cy + dy);
    g.stroke({ color: straw, width: 1 });
  }
  g.moveTo(cx, cy + 2);
  g.lineTo(cx - 0.5, cy - 9);
  g.stroke({ color: 0xe8c488, width: 0.9, alpha: 0.85 });
};

const drawDesertCairn: PropDraw = (g, cx, cy) => {
  const dark = 0x3a2a1c, stone = 0x7a6a4c, hi = 0xc8b488;
  g.ellipse(cx, cy + 3, 8, 2).fill({ color: dark, alpha: 0.55 });
  // Bottom stone — base + sun-hit top facet for volume.
  g.poly([cx - 6, cy + 3, cx - 7, cy, cx - 2, cy - 2, cx + 2, cy + 2])
    .fill({ color: stone }).stroke({ color: dark, width: 0.6 });
  g.poly([cx - 7, cy, cx - 2, cy - 2, cx + 2, cy + 2, cx - 6, cy + 3])
    .fill({ color: hi, alpha: 0.18 });
  // Middle stone.
  g.poly([cx - 2, cy - 1, cx - 3, cy - 5, cx + 3, cy - 6, cx + 4, cy - 2])
    .fill({ color: stone }).stroke({ color: dark, width: 0.6 });
  g.poly([cx - 3, cy - 5, cx + 3, cy - 6, cx + 4, cy - 2, cx - 2, cy - 1])
    .fill({ color: hi, alpha: 0.22 });
  // Top stone + crisp sun-hit top edge.
  g.poly([cx, cy - 5, cx - 1, cy - 9, cx + 3, cy - 9, cx + 3, cy - 5])
    .fill({ color: stone }).stroke({ color: dark, width: 0.6 });
  g.moveTo(cx - 1, cy - 9); g.lineTo(cx + 3, cy - 9);
  g.stroke({ color: hi, width: 0.8, alpha: 0.85 });
};

const drawDesertBrush: PropDraw = (g, cx, cy) => {
  const twig = 0x5a3a18, dark = 0x2a1a08;
  g.ellipse(cx, cy + 3, 8, 2).fill({ color: dark, alpha: 0.5 });
  for (const [dx, dy] of [[-6, -4], [-4, -7], [-1, -8], [2, -7], [5, -5], [7, -1]] as const) {
    g.moveTo(cx, cy + 2);
    g.lineTo(cx + dx, cy + dy);
    g.stroke({ color: twig, width: 1.2 });
    g.moveTo(cx + dx, cy + dy);
    g.lineTo(cx + dx + (dx > 0 ? 2 : -2), cy + dy - 2);
    g.stroke({ color: twig, width: 0.7 });
  }
};

const drawDesertSkull: PropDraw = (g, cx, cy) => {
  const bone = 0xe4d8b0, dark = 0x3a2a1c, hi = 0xfaf2d8;
  g.ellipse(cx, cy + 3, 7, 2).fill({ color: dark, alpha: 0.55 });
  // Cranium base + a small sun-hit ellipse on the top-right of the dome
  // so the skull reads as a 3D ovoid rather than a flat circle.
  g.ellipse(cx, cy - 2, 6, 5).fill({ color: bone }).stroke({ color: dark, width: 0.8 });
  g.ellipse(cx + 1, cy - 4, 3, 2).fill({ color: hi, alpha: 0.5 });
  // Jaw.
  g.poly([cx - 3, cy + 1, cx + 3, cy + 1, cx + 2, cy + 4, cx - 2, cy + 4])
    .fill({ color: bone }).stroke({ color: dark, width: 0.7 });
  // Eye sockets + nasal cavity.
  g.circle(cx - 2, cy - 2, 1.2).fill({ color: dark });
  g.circle(cx + 2, cy - 2, 1.2).fill({ color: dark });
  g.poly([cx - 0.6, cy, cx + 0.6, cy, cx, cy + 1.2])
    .fill({ color: dark });
};

const drawDesertPrayerStake: PropDraw = (g, cx, cy) => {
  const wood = 0x4a2818, cloth = 0xc87030, dark = 0x2a1408, rim = 0xe8c488;
  g.ellipse(cx, cy + 4, 5, 1.6).fill({ color: dark, alpha: 0.55 });
  g.rect(cx - 0.6, cy - 14, 1.4, 18).fill({ color: wood });
  g.poly([cx + 0.8, cy - 13, cx + 8, cy - 12, cx + 8, cy - 5, cx + 0.8, cy - 6])
    .fill({ color: cloth }).stroke({ color: dark, width: 0.6 });
  g.moveTo(cx + 0.8, cy - 13); g.lineTo(cx + 8, cy - 12);
  g.stroke({ color: rim, width: 0.8, alpha: 0.75 });
  g.moveTo(cx + 0.8, cy - 6);
  g.lineTo(cx + 3, cy - 5.5);
  g.lineTo(cx + 4.5, cy - 7);
  g.lineTo(cx + 6, cy - 5);
  g.lineTo(cx + 8, cy - 5);
  g.stroke({ color: dark, width: 0.5 });
};

export const DESERT_PROPS: PropDraw[] = [
  drawDesertBones, drawDesertSignpost, drawDesertCactus, drawDesertRag, drawDesertGrass,
  drawDesertCairn, drawDesertBrush, drawDesertSkull, drawDesertPrayerStake,
];

// --- Desert decals --------------------------------------------------

const drawDesertFootprint: PropDraw = (g, cx, cy) => {
  const dark = 0x2a1a0a;
  g.ellipse(cx - 2, cy,     1.6, 2.6).fill({ color: dark, alpha: 0.55 });
  g.ellipse(cx + 2, cy + 3, 1.6, 2.6).fill({ color: dark, alpha: 0.55 });
};

const drawDesertScorch: PropDraw = (g, cx, cy) => {
  g.ellipse(cx, cy, 5, 3).fill({ color: 0x120a06, alpha: 0.55 });
  g.ellipse(cx, cy, 2.5, 1.5).fill({ color: 0x050302, alpha: 0.75 });
};

const drawDesertCasings: PropDraw = (g, cx, cy) => {
  const brass = 0xd8a048;
  g.rect(cx - 2, cy,     1.6, 0.8).fill({ color: brass });
  g.rect(cx + 1, cy - 1, 1.6, 0.8).fill({ color: brass });
  g.rect(cx,     cy + 2, 1.6, 0.8).fill({ color: brass });
};

const drawDesertDragMark: PropDraw = (g, cx, cy) => {
  const dark = 0x3a2414;
  g.moveTo(cx - 5, cy - 1); g.lineTo(cx + 5, cy + 1);
  g.stroke({ color: dark, width: 0.8, alpha: 0.7 });
  g.moveTo(cx - 5, cy + 1); g.lineTo(cx + 5, cy + 3);
  g.stroke({ color: dark, width: 0.8, alpha: 0.7 });
};

const drawDesertCrack: PropDraw = (g, cx, cy) => {
  const dark = 0x1a0e06;
  g.moveTo(cx - 4, cy - 1);
  g.lineTo(cx - 1, cy);
  g.lineTo(cx + 1, cy - 2);
  g.lineTo(cx + 4, cy + 1);
  g.stroke({ color: dark, width: 0.7, alpha: 0.7 });
};

const drawDesertBlood: PropDraw = (g, cx, cy) => {
  const rust = 0x6a1810;
  g.ellipse(cx, cy, 2.8, 1.8).fill({ color: rust, alpha: 0.75 });
  g.circle(cx + 3, cy - 1, 0.6).fill({ color: rust, alpha: 0.7 });
  g.circle(cx - 3, cy + 1, 0.5).fill({ color: rust, alpha: 0.65 });
};

const drawDesertPaw: PropDraw = (g, cx, cy) => {
  const dark = 0x2a1a0a;
  g.ellipse(cx, cy + 1, 1.6, 2).fill({ color: dark, alpha: 0.6 });
  g.circle(cx - 1.8, cy - 1, 0.6).fill({ color: dark, alpha: 0.6 });
  g.circle(cx,       cy - 2, 0.6).fill({ color: dark, alpha: 0.6 });
  g.circle(cx + 1.8, cy - 1, 0.6).fill({ color: dark, alpha: 0.6 });
};

const drawDesertBoneShard: PropDraw = (g, cx, cy) => {
  const bone = 0xd8c8a0;
  g.rect(cx - 2, cy, 4, 1).fill({ color: bone, alpha: 0.85 });
  g.circle(cx - 2, cy + 0.5, 0.7).fill({ color: bone, alpha: 0.85 });
  g.circle(cx + 2, cy + 0.5, 0.7).fill({ color: bone, alpha: 0.85 });
};

export const DESERT_DECALS: PropDraw[] = [
  drawDesertFootprint, drawDesertScorch, drawDesertCasings, drawDesertDragMark,
  drawDesertCrack, drawDesertBlood, drawDesertPaw, drawDesertBoneShard,
];

// --- Desert edge bumps ----------------------------------------------

const drawEdgeDune: PropDraw = (g, cx, cy) => {
  g.ellipse(cx, cy + 8, 34, 7).fill({ color: 0x3a2a1c, alpha: 0.5 });
  g.poly([
    cx - 30, cy + 10,
    cx - 20, cy - 4,
    cx - 8,  cy - 9,
    cx + 6,  cy - 10,
    cx + 18, cy - 6,
    cx + 30, cy + 8,
  ]).fill({ color: 0xb08658, alpha: 0.95 });
  g.moveTo(cx - 30, cy + 10); g.lineTo(cx - 20, cy - 4); g.lineTo(cx - 8, cy - 9);
  g.stroke({ color: 0xe0c089, width: 1.2, alpha: 0.7 });
};

const drawEdgeRock: PropDraw = (g, cx, cy) => {
  g.poly([cx - 10, cy + 6, cx - 6, cy - 12, cx, cy - 10, cx + 4, cy + 2])
    .fill({ color: 0x6a4828 }).stroke({ color: 0x2a1a0a, width: 0.8 });
  g.poly([cx + 2, cy + 6, cx + 8, cy - 8, cx + 14, cy - 4, cx + 14, cy + 6])
    .fill({ color: 0x5a3820 }).stroke({ color: 0x2a1a0a, width: 0.8 });
  g.ellipse(cx, cy + 7, 18, 3).fill({ color: 0x1a0a04, alpha: 0.6 });
};

const drawEdgeBoneCairn: PropDraw = (g, cx, cy) => {
  g.ellipse(cx, cy + 4, 9, 3).fill({ color: 0x1a0a04, alpha: 0.55 });
  g.rect(cx - 5, cy - 2, 10, 5).fill({ color: 0x6a5a3a }).stroke({ color: 0x2a1a0a, width: 0.6 });
  g.rect(cx - 4, cy - 7, 8, 5).fill({ color: 0x7a6a46 }).stroke({ color: 0x2a1a0a, width: 0.6 });
  g.rect(cx - 3, cy - 11, 6, 4).fill({ color: 0x8a7a50 }).stroke({ color: 0x2a1a0a, width: 0.6 });
  g.moveTo(cx - 8, cy); g.lineTo(cx + 8, cy - 16);
  g.stroke({ color: 0xe4d8b0, width: 1.6 });
};

export const EDGE_DUNES: PropDraw[] = [drawEdgeDune, drawEdgeRock, drawEdgeBoneCairn];

// --- Per-tile detail passes -----------------------------------------

/**
 * Per-tile desert floor / wall detail. Deterministic by (x, y) so the map
 * holds still — every redraw, the same pebbles / cracks / dunes sit in the
 * same spots. Three floor variants carry three distinct characters:
 *   - variant 0: plain sand — scattered pebble flecks.
 *   - variant 1: wind-drift sand — pebbles + a curving sand trail.
 *   - variant 2: cracked earth — a branching crack pattern.
 * All floors also get a golden rim-highlight on the NE edge.
 *
 * Walls get three brick courses, a top sun highlight, and occasional
 * vertical weather-drip stains so they read as weathered adobe.
 */
export function drawDesertDetail(
  g: Graphics, kind: TileKind, variant: number,
  px: number, py: number, gx: number, gy: number, pal: TilePalette,
) {
  const h = (gx * 73856093 ^ gy * 19349663) >>> 0;
  const rand = (salt: number) => ((h + salt * 2654435761) >>> 0) / 0xffffffff;

  if (kind === 'floor') {
    g.moveTo(px, py - TILE_H / 2);
    g.lineTo(px + TILE_W / 2, py);
    g.stroke({ color: pal.rimHighlight, width: 0.8, alpha: 0.55 });

    // Pebble flecks (existing) — slightly punchier alpha now that the
    // sun/shadow split sits underneath them.
    const n = ((h >>> 4) % 2) + 2;
    for (let i = 0; i < n; i++) {
      const dx = (rand(i * 3 + 1) * 18 - 9) | 0;
      const dy = (rand(i * 3 + 2) * 8 - 4) | 0;
      const r = 0.7 + rand(i * 3 + 3) * 0.6;
      const light = rand(i * 3 + 4) < 0.35;
      g.circle(px + dx, py + dy, r).fill({
        color: light ? pal.accentLight : pal.accent,
        alpha: light ? 0.6 : 0.7,
      });
    }

    // Fine sand-grain texture: 6-9 sub-pixel specks scattered around
    // the diamond. Mixes the painted highlight + shadow halves so the
    // tile reads less stamped — closer to a real painted ground.
    const grains = 6 + (((h >>> 8) & 0x3) | 0);
    for (let i = 0; i < grains; i++) {
      // Sample inside the diamond shape (rough rhombus rejection).
      const gx = (rand(i * 7 + 50) * 26 - 13);
      const gy = (rand(i * 7 + 51) * 12 - 6);
      // Reject points outside the diamond by chebyshev-style metric.
      if (Math.abs(gx) / 13 + Math.abs(gy) / 6 > 1) continue;
      const r = 0.35 + rand(i * 7 + 52) * 0.25;
      const warm = rand(i * 7 + 53) < 0.5;
      g.circle(px + gx, py + gy, r).fill({
        color: warm ? pal.rimHighlight : pal.accent,
        alpha: 0.35,
      });
    }

    if (variant === 1) {
      g.moveTo(px - 12, py + 2);
      g.quadraticCurveTo(px, py - 2, px + 12, py + 2);
      g.stroke({ color: pal.accentLight, width: 0.7, alpha: 0.45 });
      g.moveTo(px - 9, py + 4);
      g.quadraticCurveTo(px, py + 1, px + 9, py + 4);
      g.stroke({ color: pal.accent, width: 0.5, alpha: 0.4 });
    } else if (variant === 2) {
      g.moveTo(px - 10, py + 1);
      g.lineTo(px - 3, py - 1);
      g.lineTo(px + 4, py + 2);
      g.lineTo(px + 11, py - 1);
      g.stroke({ color: pal.accent, width: 0.7, alpha: 0.6 });
      g.moveTo(px - 3, py - 1);
      g.lineTo(px - 1, py + 3);
      g.stroke({ color: pal.accent, width: 0.5, alpha: 0.5 });
      g.moveTo(px + 4, py + 2);
      g.lineTo(px + 6, py - 2);
      g.stroke({ color: pal.accent, width: 0.5, alpha: 0.5 });
    }

    if (rand(9) < 0.12) {
      const sx = px + (rand(10) * 10 - 5);
      const sy = py + (rand(11) * 4 - 2);
      g.poly([sx - 2, sy, sx + 1, sy - 2, sx + 2, sy + 1])
        .fill({ color: pal.coverStroke, alpha: 0.55 })
        .stroke({ color: pal.accent, width: 0.4, alpha: 0.7 });
    }
  } else if (kind === 'wall') {
    g.rect(px - 10, py - 4, 20, 0.7).fill({ color: pal.accent, alpha: 0.6 });
    g.rect(px - 10, py - 1, 20, 0.7).fill({ color: pal.accent, alpha: 0.6 });
    g.rect(px - 10, py + 3, 20, 0.7).fill({ color: pal.accent, alpha: 0.6 });
    g.rect(px - 4, py - 4, 0.6, 3).fill({ color: pal.accent, alpha: 0.55 });
    g.rect(px + 2, py - 1, 0.6, 4).fill({ color: pal.accent, alpha: 0.55 });
    g.rect(px - 6, py + 3, 0.6, 3).fill({ color: pal.accent, alpha: 0.55 });
    g.moveTo(px - TILE_W / 2, py);
    g.lineTo(px, py - TILE_H / 2);
    g.stroke({ color: pal.wallHighlight, width: 1.1, alpha: 0.7 });
    g.moveTo(px, py - TILE_H / 2);
    g.lineTo(px + TILE_W / 2, py);
    g.stroke({ color: pal.wallHighlight, width: 1.1, alpha: 0.6 });
    if (rand(20) < 0.3) {
      const dx = (rand(21) * 16 - 8) | 0;
      g.rect(px + dx, py - 4, 0.5, 7).fill({ color: pal.wallStain, alpha: 0.55 });
    }
  }
}

// --- Desert cover silhouette variants ------------------------------
//
// Per-tile alternate silhouettes for ISOLATED cover blocks (connected
// cover tiles always use the default trapezoid so the wall extenders
// bridge cleanly). Hash-driven dispatch in `drawDesertCoverVariant`
// picks one of these for ~40-50% of isolated tiles; the remainder fall
// through to the default sandstone-column / clay-brick trapezoid.
//
// Each variant draws BOTH silhouette + per-shape detail so its lighting
// reads consistently — sun-hit top edge, right-side shade, contact
// shadow strip on the ground line.

/**
 * Wooden crate (cover_half). Rectangle body with vertical plank
 * grooves, iron banding top + bottom. Slight inward batter so it
 * doesn't fight the sandstone palette around it.
 */
function drawCrate(g: Graphics, px: number, py: number, h: number) {
  const wood = 0x6a4828, woodDark = 0x3a2814, woodHi = 0x9a7048, iron = 0x2a1e10;
  const left = px - 13, right = px + 13, top = py - h, bot = py;
  // Body
  g.poly([left, bot, left + 1, top, right - 1, top, right, bot])
    .fill({ color: wood }).stroke({ color: woodDark, width: 0.8 });
  // Plank grooves
  for (const x of [px - 7, px, px + 7]) {
    g.rect(x - 0.3, top + 1, 0.6, h - 2).fill({ color: woodDark, alpha: 0.6 });
  }
  // Iron bands — top + bottom
  g.rect(left, top, right - left, 1.4).fill({ color: iron });
  g.rect(left, bot - 1.4, right - left, 1.4).fill({ color: iron });
  // Sun-hit ridge along the top + N face
  g.rect(left + 1, top + 1.4, right - left - 2, 0.8).fill({ color: woodHi, alpha: 0.85 });
  // Right-side shade
  g.rect(right - 2, top + 1.4, 2, h - 2.8).fill({ color: woodDark, alpha: 0.5 });
  // Contact shadow
  g.rect(left + 1, bot - 0.6, right - left - 2, 0.8).fill({ color: 0x000000, alpha: 0.35 });
}

/**
 * Sandbag pile (cover_half). Three sandbags — two on bottom, one on
 * top — drawn as soft round-cornered rectangles with frayed corners.
 */
function drawSandbags(g: Graphics, px: number, py: number, h: number) {
  const tan = 0xb89668, tanDark = 0x6a4a26, tanHi = 0xd8b888, dark = 0x2a1a0a;
  const bot = py;
  // Bottom row — two bags
  g.roundRect(px - 13, bot - 7, 13, 7, 2).fill({ color: tan }).stroke({ color: tanDark, width: 0.6 });
  g.roundRect(px,      bot - 7, 13, 7, 2).fill({ color: tan }).stroke({ color: tanDark, width: 0.6 });
  // Top bag (centred, smaller)
  const topH = Math.max(5, h - 7);
  g.roundRect(px - 8, bot - 7 - topH, 16, topH, 2)
    .fill({ color: tan }).stroke({ color: tanDark, width: 0.6 });
  // Sun-hit highlights on each bag's top edge
  g.rect(px - 12, bot - 6, 11, 0.8).fill({ color: tanHi, alpha: 0.65 });
  g.rect(px + 1,  bot - 6, 11, 0.8).fill({ color: tanHi, alpha: 0.65 });
  g.rect(px - 7,  bot - 7 - topH + 1, 14, 0.8).fill({ color: tanHi, alpha: 0.7 });
  // Frayed-corner stitches
  for (const [cx, cy] of [[px - 13, bot - 3.5], [px, bot - 3.5], [px - 8, bot - 7 - topH / 2]] as const) {
    g.circle(cx + 0.5, cy, 0.6).fill({ color: dark, alpha: 0.4 });
  }
  // Contact shadow
  g.rect(px - 13, bot - 0.6, 26, 0.8).fill({ color: 0x000000, alpha: 0.4 });
}

/**
 * Stacked barrels (cover_full). Two barrels on the bottom row + one
 * smaller on top, banded with iron rings and gentle vertical stave
 * lines for the curved-wood read.
 */
function drawBarrels(g: Graphics, px: number, py: number, h: number) {
  const wood = 0x7a5028, woodDark = 0x3a2410, woodHi = 0xa87038, iron = 0x2a1810, ironHi = 0x6a4a30;
  const bot = py, half = h / 2;
  // Lower row — two barrels side by side, slightly inset
  const drawBarrel = (cx: number, top: number, bh: number, bw: number) => {
    g.roundRect(cx - bw / 2, top, bw, bh, bw * 0.18)
      .fill({ color: wood }).stroke({ color: woodDark, width: 0.7 });
    // Stave grooves
    for (const dx of [-bw * 0.25, 0, bw * 0.25]) {
      g.rect(cx + dx - 0.25, top + 1, 0.5, bh - 2).fill({ color: woodDark, alpha: 0.45 });
    }
    // Iron bands
    g.rect(cx - bw / 2, top + bh * 0.18, bw, 1).fill({ color: iron });
    g.rect(cx - bw / 2, top + bh * 0.78, bw, 1).fill({ color: iron });
    // Sun-hit highlight on N face
    g.rect(cx - bw / 2 + 0.6, top + 0.6, bw - 1.2, 0.6)
      .fill({ color: woodHi, alpha: 0.85 });
    g.rect(cx - bw / 2, top + bh * 0.18, bw, 0.4).fill({ color: ironHi, alpha: 0.7 });
  };
  drawBarrel(px - 7, bot - half, half, 12);
  drawBarrel(px + 7, bot - half, half, 12);
  drawBarrel(px,     bot - h,    half, 12);
  // Contact shadow
  g.rect(px - 13, bot - 0.6, 26, 0.8).fill({ color: 0x000000, alpha: 0.4 });
}

/**
 * Market stall (cover_full). Wooden frame with a draped canvas roof.
 * Reads as a covered merchant stand more than a battle obstacle, but
 * fits the desert bazaar setting and breaks up the sandstone-column
 * monotony.
 */
function drawMarketStall(g: Graphics, px: number, py: number, h: number) {
  const post = 0x3a2412, postHi = 0x6a4a26, canvas = 0xc89060, canvasHi = 0xe0b080, canvasShade = 0x7a4a26;
  const top = py - h, bot = py;
  // Four corner posts (front pair brighter, back pair darker)
  g.rect(px - 13, top + 2, 1.4, h - 2).fill({ color: post });
  g.rect(px + 11.6, top + 2, 1.4, h - 2).fill({ color: post });
  // Sun-hit highlight on E posts
  g.rect(px - 13, top + 2, 0.4, h - 2).fill({ color: postHi, alpha: 0.7 });
  g.rect(px + 11.6, top + 2, 0.4, h - 2).fill({ color: postHi, alpha: 0.5 });
  // Canvas roof — tapered top with a soft droop
  g.poly([
    px - 14, top + 4,
    px - 11, top - 1,
    px + 11, top - 1,
    px + 14, top + 4,
    px + 12, top + 5,
    px - 12, top + 5,
  ]).fill({ color: canvas }).stroke({ color: canvasShade, width: 0.6 });
  // Highlight along the ridge
  g.moveTo(px - 11, top - 1); g.lineTo(px + 11, top - 1);
  g.stroke({ color: canvasHi, width: 1.2, alpha: 0.85 });
  // Diagonal cloth folds
  for (const dx of [-7, -2, 4, 9] as const) {
    g.moveTo(px + dx, top + 0); g.lineTo(px + dx + 2, top + 5);
    g.stroke({ color: canvasShade, width: 0.5, alpha: 0.5 });
  }
  // Wooden counter at the front
  g.rect(px - 12, bot - 4, 24, 2).fill({ color: post });
  g.rect(px - 12, bot - 4, 24, 0.6).fill({ color: postHi, alpha: 0.7 });
  // Contact shadow
  g.rect(px - 13, bot - 0.6, 26, 0.8).fill({ color: 0x000000, alpha: 0.4 });
}

/**
 * Hash-driven dispatcher for the four variant silhouettes. Returns
 * `'drew'` when a variant fired and `'default'` when the caller should
 * fall through to the standard sandstone-column / clay-brick trapezoid
 * path. Connected cover tiles never reach this function (they always
 * use the default so wall extenders bridge correctly) — see drawMap.ts.
 *
 * Distribution per tile:
 *   - cover_full: ~40% variant (20% barrels + 20% market stall),
 *                 ~60% default sandstone column.
 *   - cover_half: ~40% variant (20% crate + 20% sandbags),
 *                 ~60% default clay-brick wall.
 */
export function drawDesertCoverVariant(
  g: Graphics, kind: TileKind,
  px: number, py: number, h: number, hash: number, _pal: TilePalette,
): 'drew' | 'default' {
  // Bucket 0..9 from a stable bit-slice of the tile hash.
  const bucket = (hash >>> 16) % 10;
  if (kind === 'cover_full') {
    if (bucket < 2)         { drawBarrels(g, px, py, h); return 'drew'; }
    if (bucket < 4)         { drawMarketStall(g, px, py, h); return 'drew'; }
    return 'default';
  }
  if (kind === 'cover_half') {
    if (bucket < 2)         { drawCrate(g, px, py, h); return 'drew'; }
    if (bucket < 4)         { drawSandbags(g, px, py, h); return 'drew'; }
    return 'default';
  }
  return 'default';
}

/**
 * Adobe masonry on raised cover: horizontal brick courses + a centered
 * decorative seam, top sun highlight, and a right-side shadow band so the
 * pillar reads as 3D. Full cover also gets vertical seams and a mid-band cornice.
 *
 * Shading was tightened in the painted-detail pass: the top sun
 * highlight gets a softer secondary band; a left-side gentle bevel
 * mirrors the right-side shade; and a contact-shadow strip darkens
 * the ground line so the pillar reads as planted, not floating.
 */
export function drawDesertCoverDetail(
  g: Graphics, kind: TileKind,
  px: number, py: number, h: number, gx: number, gy: number, pal: TilePalette,
) {
  const left = px - 14, right = px + 14, top = py - h, bot = py;

  // Top sun highlight — punchier two-band stack so the sun-hit ridge
  // pops against the new universal sun-cast diamond underneath.
  g.rect(left, top, 28, 1.4).fill({ color: pal.coverHighlight, alpha: 0.95 });
  g.rect(left, top + 1.4, 28, 0.8).fill({ color: pal.coverHighlight, alpha: 0.45 });

  // Right-side shade band (existing) + gentle left-side bevel so the
  // silhouette has a planted volume rather than a flat-cut tape stripe.
  g.rect(right - 2.5, top + 1.2, 2.5, h - 1.2)
    .fill({ color: pal.coverShade, alpha: 0.55 });
  g.rect(left, top + 1.2, 1.6, h - 1.2)
    .fill({ color: pal.coverHighlight, alpha: 0.18 });

  // Contact shadow strip on the ground line — the cover meets the
  // diamond's W↔E split, and a 1-px dark band sells the planted seal.
  g.rect(left + 1, bot - 1, 26, 1).fill({ color: pal.coverStroke, alpha: 0.4 });

  for (let y = top + 4; y < bot; y += 4) {
    g.rect(left, y, 28, 0.6).fill({ color: pal.coverStroke, alpha: 0.55 });
  }
  const hash = ((gx * 31 + gy * 17) >>> 0);
  for (let i = 0, y = top + 4; y < bot; y += 4, i++) {
    const seamX = left + 6 + ((hash + i * 7) % 14);
    g.rect(seamX, y - 4, 0.6, 4).fill({ color: pal.coverStroke, alpha: 0.5 });
  }

  if (kind === 'cover_full') {
    const mid = Math.round(top + h * 0.45);
    g.rect(left - 1, mid, 30, 1.4).fill({ color: pal.coverHighlight, alpha: 0.7 });
    g.rect(left - 1, mid + 1.4, 30, 0.6).fill({ color: pal.coverStroke, alpha: 0.7 });
    g.rect(left + 9, top, 0.6, h).fill({ color: pal.coverStroke, alpha: 0.55 });
    g.rect(left + 19, top, 0.6, h).fill({ color: pal.coverStroke, alpha: 0.55 });
  }
}

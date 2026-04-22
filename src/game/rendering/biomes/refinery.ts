import type { Graphics } from 'pixi.js';
import type { TileKind } from '../../types';
import { TILE_W, TILE_H } from '../isoProjection';
import type { PropDraw, TilePalette } from '../context';

/**
 * Refinery biome — desert with industrial wreckage. Warm palette shared
 * with desert, but walls are rusted sheet-metal, half cover is pipe runs,
 * and full cover is storage tanks.
 */
export const REFINERY_PALETTE: TilePalette = {
  floor: [0xc9a874, 0xb3935c, 0x8a724e], // sand + concrete pad + oil-stained apron
  floorStroke: 0x5a4428,
  wall: 0x5a3828,                         // rusted steel plate
  wallHighlight: 0xa87248,                // sunlit rust edge
  wallStain: 0x1a0a04,                    // dark oil / char streaks
  halfCover: 0x9a5a2e,                    // rusted pipe orange
  fullCover: 0x8a7868,                    // grey-steel tank
  coverHighlight: 0xd4c4a4,               // metal sheen
  coverShade: 0x3a2a1c,                   // deep shadow
  coverStroke: 0x1a0e08,
  accent: 0x3a2a1c,                       // rivets / concrete cracks
  accentLight: 0xd4c4a4,                  // metal glint
  rimHighlight: 0xe0c089,                 // shared golden NE-edge rim
};

// --- Refinery props -------------------------------------------------

const drawRefineryDrum: PropDraw = (g, cx, cy) => {
  const body = 0x8a6a4a, rim = 0xe8c488, dark = 0x1a0e08, rust = 0xa04818;
  g.rect(cx - 4, cy - 9, 8, 11).fill({ color: body }).stroke({ color: dark, width: 0.7 });
  g.rect(cx - 4, cy - 9, 8, 1.4).fill({ color: rim, alpha: 0.75 });
  g.rect(cx - 4, cy + 1, 8, 0.8).fill({ color: dark, alpha: 0.7 });
  g.rect(cx - 1.4, cy - 7, 0.9, 7).fill({ color: rust, alpha: 0.85 });
  g.rect(cx + 1.4, cy - 4, 0.6, 5).fill({ color: rust, alpha: 0.7 });
};

const drawRefineryValve: PropDraw = (g, cx, cy) => {
  const steel = 0x8a7868, dark = 0x1a0e08, rim = 0xd4c4a4;
  g.circle(cx, cy - 3, 5.5).fill({ color: steel }).stroke({ color: dark, width: 0.7 });
  g.circle(cx, cy - 3, 1.8).fill({ color: dark });
  for (const [dx, dy] of [[0, -5], [0, 5], [-5, 0], [5, 0], [3.5, -3.5], [-3.5, 3.5]] as const) {
    g.moveTo(cx, cy - 3); g.lineTo(cx + dx, cy - 3 + dy);
    g.stroke({ color: rim, width: 1, alpha: 0.85 });
  }
};

const drawRefineryToolbox: PropDraw = (g, cx, cy) => {
  const red = 0x9a2a1a, dark = 0x1a0a04, rim = 0xe8c488;
  g.rect(cx - 5, cy - 2, 10, 5).fill({ color: red }).stroke({ color: dark, width: 0.7 });
  g.rect(cx - 5, cy - 2, 10, 0.9).fill({ color: rim, alpha: 0.55 });
  g.rect(cx - 0.6, cy - 2, 1.2, 1).fill({ color: dark });
  g.moveTo(cx - 3, cy - 2);
  g.quadraticCurveTo(cx, cy - 5, cx + 3, cy - 2);
  g.stroke({ color: dark, width: 1.1 });
};

const drawRefineryHose: PropDraw = (g, cx, cy) => {
  const hose = 0x1a1010, shine = 0x5a4828;
  g.circle(cx - 3, cy, 3.4).stroke({ color: hose, width: 1.6 });
  g.circle(cx + 3, cy - 1, 3.2).stroke({ color: hose, width: 1.6 });
  g.circle(cx, cy + 2, 2.8).stroke({ color: hose, width: 1.4 });
  g.circle(cx - 3, cy, 3.4).stroke({ color: shine, width: 0.5, alpha: 0.6 });
};

const drawRefineryCables: PropDraw = (g, cx, cy) => {
  const black = 0x1a1010, copper = 0x8a4828, rust = 0x5a2818;
  g.ellipse(cx, cy + 3, 12, 2).fill({ color: black, alpha: 0.55 });
  g.moveTo(cx - 8, cy + 2); g.quadraticCurveTo(cx - 2, cy - 5, cx + 6, cy + 1);
  g.stroke({ color: black, width: 2.4 });
  g.moveTo(cx - 7, cy + 3); g.quadraticCurveTo(cx + 1, cy - 3, cx + 8, cy + 2);
  g.stroke({ color: rust, width: 1.6 });
  g.moveTo(cx + 2, cy - 2); g.lineTo(cx + 4, cy - 2.2);
  g.stroke({ color: copper, width: 1.1 });
};

const drawRefineryVent: PropDraw = (g, cx, cy) => {
  const steel = 0x7a6a5a, dark = 0x1a0e08, shine = 0xc8b498, warning = 0xe8c488;
  g.rect(cx - 7, cy - 4, 14, 8).fill({ color: steel })
    .stroke({ color: dark, width: 0.8 });
  for (const sy of [-2, 0, 2]) {
    g.rect(cx - 6, cy + sy, 12, 1).fill({ color: dark, alpha: 0.85 });
  }
  for (const [rx, ry] of [[-6, -3], [6, -3], [-6, 3], [6, 3]] as const) {
    g.circle(cx + rx, cy + ry, 0.7).fill({ color: shine });
    g.circle(cx + rx, cy + ry, 0.35).fill({ color: dark });
  }
  g.rect(cx - 7, cy + 4, 14, 0.8).fill({ color: warning, alpha: 0.85 });
};

const drawRefinerySludge: PropDraw = (g, cx, cy) => {
  const black = 0x0a0408, green = 0x385028, purple = 0x4a2a5a, hi = 0x5a7040;
  g.poly([
    cx - 9, cy + 1,
    cx - 6, cy - 4,
    cx, cy - 5,
    cx + 6, cy - 3,
    cx + 9, cy + 1,
    cx + 7, cy + 4,
    cx - 1, cy + 5,
    cx - 7, cy + 4,
  ]).fill({ color: black, alpha: 0.85 });
  g.ellipse(cx - 2, cy - 1, 4, 1.6).fill({ color: green, alpha: 0.5 });
  g.ellipse(cx + 3, cy, 3, 1.4).fill({ color: purple, alpha: 0.45 });
  g.ellipse(cx + 1, cy - 2, 1.5, 0.8).fill({ color: hi, alpha: 0.7 });
};

const drawRefineryCone: PropDraw = (g, cx, cy) => {
  const orange = 0xd8602a, dark = 0x1a0a04, white = 0xd8c898;
  g.ellipse(cx, cy + 4, 5, 1.4).fill({ color: dark, alpha: 0.55 });
  g.poly([cx - 3.5, cy + 4, cx + 3.5, cy + 4, cx + 1, cy - 10, cx - 1, cy - 10])
    .fill({ color: orange }).stroke({ color: dark, width: 0.7 });
  g.poly([cx - 2.4, cy - 2, cx + 2.4, cy - 2, cx + 1.9, cy - 5, cx - 1.9, cy - 5])
    .fill({ color: white, alpha: 0.9 });
  g.rect(cx - 1, cy - 11, 2, 1).fill({ color: dark });
};

export const REFINERY_PROPS: PropDraw[] = [
  drawRefineryDrum, drawRefineryValve, drawRefineryToolbox, drawRefineryHose,
  drawRefineryCables, drawRefineryVent, drawRefinerySludge, drawRefineryCone,
];

// --- Refinery decals ------------------------------------------------

const drawRefineryOilDrip: PropDraw = (g, cx, cy) => {
  g.ellipse(cx, cy, 3.2, 1.6).fill({ color: 0x050302, alpha: 0.8 });
  g.ellipse(cx - 0.5, cy - 0.2, 1, 0.5).fill({ color: 0x3a4228, alpha: 0.55 });
};

const drawRefineryScorch: PropDraw = (g, cx, cy) => {
  g.ellipse(cx, cy, 5, 3).fill({ color: 0x0a0604, alpha: 0.65 });
  g.ellipse(cx + 1, cy - 0.5, 1.6, 0.8).fill({ color: 0x5a2a10, alpha: 0.55 });
};

const drawRefineryCasings: PropDraw = (g, cx, cy) => {
  const brass = 0xe4b858;
  for (const [dx, dy] of [[-3, 0], [0, 2], [2, -1], [3, 1]] as const) {
    g.rect(cx + dx, cy + dy, 1.6, 0.7).fill({ color: brass });
  }
};

const drawRefineryChalkArrow: PropDraw = (g, cx, cy) => {
  const chalk = 0xe8d498;
  g.moveTo(cx - 3, cy); g.lineTo(cx + 3, cy);
  g.stroke({ color: chalk, width: 0.8, alpha: 0.8 });
  g.moveTo(cx + 3, cy); g.lineTo(cx + 1, cy - 2);
  g.stroke({ color: chalk, width: 0.8, alpha: 0.8 });
  g.moveTo(cx + 3, cy); g.lineTo(cx + 1, cy + 2);
  g.stroke({ color: chalk, width: 0.8, alpha: 0.8 });
};

const drawRefineryRustSpots: PropDraw = (g, cx, cy) => {
  const rust = 0x8a4020;
  g.circle(cx - 2, cy - 1, 0.9).fill({ color: rust, alpha: 0.8 });
  g.circle(cx + 1, cy,     1.1).fill({ color: rust, alpha: 0.85 });
  g.circle(cx + 3, cy + 2, 0.8).fill({ color: rust, alpha: 0.75 });
  g.circle(cx - 1, cy + 2, 0.7).fill({ color: rust, alpha: 0.7 });
};

const drawRefineryBolt: PropDraw = (g, cx, cy) => {
  const steel = 0x8a8878, dark = 0x1a0e08;
  for (const [dx, dy] of [[-2, 0], [1, -1], [2, 2]] as const) {
    g.rect(cx + dx - 0.8, cy + dy - 0.8, 1.6, 1.6).fill({ color: steel })
      .stroke({ color: dark, width: 0.3 });
  }
};

const drawRefineryBloodStreak: PropDraw = (g, cx, cy) => {
  const blood = 0x4a1408;
  g.moveTo(cx - 4, cy); g.quadraticCurveTo(cx, cy - 1, cx + 4, cy + 1);
  g.stroke({ color: blood, width: 1.4, alpha: 0.7 });
  g.circle(cx + 4, cy + 1, 1).fill({ color: blood, alpha: 0.75 });
};

const drawRefinerySparkMark: PropDraw = (g, cx, cy) => {
  const dark = 0x0a0604, spark = 0xe8c880;
  g.ellipse(cx, cy, 3.5, 1.8).fill({ color: dark, alpha: 0.6 });
  g.circle(cx - 1, cy - 0.5, 0.7).fill({ color: spark, alpha: 0.9 });
  g.circle(cx + 1, cy + 0.5, 0.6).fill({ color: spark, alpha: 0.85 });
  g.moveTo(cx - 2, cy - 2); g.lineTo(cx + 2, cy + 2);
  g.stroke({ color: spark, width: 0.4, alpha: 0.65 });
};

export const REFINERY_DECALS: PropDraw[] = [
  drawRefineryOilDrip, drawRefineryScorch, drawRefineryCasings, drawRefineryChalkArrow,
  drawRefineryRustSpots, drawRefineryBolt, drawRefineryBloodStreak, drawRefinerySparkMark,
];

// --- Refinery edge bumps --------------------------------------------

const drawEdgePipeStack: PropDraw = (g, cx, cy) => {
  g.ellipse(cx, cy + 4, 18, 2.5).fill({ color: 0x1a0a04, alpha: 0.6 });
  for (let i = 0; i < 3; i++) {
    const py = cy + 2 - i * 5;
    g.ellipse(cx, py, 16, 2.2).fill({ color: 0x5a3820 });
    g.rect(cx - 16, py - 2, 32, 4).fill({ color: 0x7a5830 }).stroke({ color: 0x2a1a0a, width: 0.7 });
    g.rect(cx - 16, py - 2, 32, 0.8).fill({ color: 0xa87248, alpha: 0.5 });
  }
};

const drawEdgeScrapHeap: PropDraw = (g, cx, cy) => {
  g.ellipse(cx, cy + 5, 20, 3).fill({ color: 0x1a0a04, alpha: 0.6 });
  g.poly([
    cx - 18, cy + 5,
    cx - 14, cy - 3,
    cx - 6,  cy - 8,
    cx - 2,  cy - 14,
    cx + 4,  cy - 10,
    cx + 10, cy - 6,
    cx + 16, cy - 2,
    cx + 20, cy + 5,
  ]).fill({ color: 0x6a3818 }).stroke({ color: 0x1a0a04, width: 0.9 });
  g.moveTo(cx + 2, cy - 14); g.lineTo(cx + 6, cy - 18);
  g.stroke({ color: 0x8a5828, width: 1 });
  g.moveTo(cx - 6, cy - 8); g.lineTo(cx - 10, cy - 12);
  g.stroke({ color: 0x8a5828, width: 0.8 });
};

const drawEdgeSmokestack: PropDraw = (g, cx, cy) => {
  g.ellipse(cx, cy + 4, 10, 2.5).fill({ color: 0x1a0a04, alpha: 0.55 });
  g.rect(cx - 4, cy - 18, 8, 22).fill({ color: 0x4a2a1c }).stroke({ color: 0x1a0a04, width: 0.8 });
  g.rect(cx - 5, cy - 20, 10, 3).fill({ color: 0x6a3820 }).stroke({ color: 0x1a0a04, width: 0.8 });
  g.rect(cx - 1, cy - 14, 0.8, 10).fill({ color: 0x8a4828, alpha: 0.7 });
  g.moveTo(cx, cy - 20); g.quadraticCurveTo(cx + 3, cy - 28, cx - 1, cy - 34);
  g.stroke({ color: 0x8a7868, width: 1.2, alpha: 0.45 });
};

export const EDGE_REFINERY_SCRAP: PropDraw[] = [
  drawEdgePipeStack, drawEdgeScrapHeap, drawEdgeSmokestack,
];

// --- Per-tile detail passes -----------------------------------------

/**
 * Ground-plane detail for refinery tiles — concrete pads on variant-0
 * floors, oil stains on variant-2, rusted-steel plate seams + rivet
 * rows on walls. Same deterministic (x,y) hash trick the desert detail
 * uses so the pattern is stable across re-renders.
 */
export function drawRefineryGroundDetail(
  g: Graphics, kind: TileKind, variant: number,
  px: number, py: number, gx: number, gy: number, pal: TilePalette,
) {
  const h = (gx * 73856093 ^ gy * 19349663) >>> 0;
  const rand = (salt: number) => ((h + salt * 2654435761) >>> 0) / 0xffffffff;

  if (kind === 'floor') {
    g.moveTo(px, py - TILE_H / 2);
    g.lineTo(px + TILE_W / 2, py);
    g.stroke({ color: pal.rimHighlight, width: 0.8, alpha: 0.35 });

    if (variant === 2) {
      g.ellipse(px + 1, py + 1, 8, 3).fill({ color: pal.coverShade, alpha: 0.55 });
      g.ellipse(px - 4, py - 1, 3, 1.5).fill({ color: pal.coverShade, alpha: 0.45 });
    } else if (variant === 0) {
      g.moveTo(px - 10, py);
      g.lineTo(px - 2, py + 1);
      g.lineTo(px + 4, py - 1);
      g.lineTo(px + 10, py + 1);
      g.stroke({ color: pal.accent, width: 0.5, alpha: 0.5 });
    }
    if (rand(3) < 0.25) {
      const rx = px + (rand(4) * 16 - 8), ry = py + (rand(5) * 6 - 3);
      g.circle(rx, ry, 0.7).fill({ color: pal.accentLight, alpha: 0.7 });
      g.circle(rx, ry, 0.3).fill({ color: pal.accent, alpha: 0.8 });
    }
  } else if (kind === 'wall') {
    g.rect(px - 11, py - 3, 22, 0.6).fill({ color: pal.accent, alpha: 0.7 });
    g.rect(px - 11, py + 2, 22, 0.6).fill({ color: pal.accent, alpha: 0.7 });
    for (let i = -4; i <= 4; i += 2) {
      const rx = px + (i % 4 === 0 ? -8 : 8);
      g.circle(rx, py + i * 0.9, 0.7).fill({ color: pal.accentLight, alpha: 0.8 });
    }
    g.moveTo(px - TILE_W / 2, py);
    g.lineTo(px, py - TILE_H / 2);
    g.stroke({ color: pal.wallHighlight, width: 1.1, alpha: 0.6 });
    g.moveTo(px, py - TILE_H / 2);
    g.lineTo(px + TILE_W / 2, py);
    g.stroke({ color: pal.wallHighlight, width: 1.1, alpha: 0.55 });
    if (rand(9) < 0.35) {
      const dx = (rand(10) * 16 - 8) | 0;
      g.rect(px + dx, py - 4, 0.6, 8).fill({ color: pal.wallStain, alpha: 0.55 });
    }
  }
}

/**
 * Raised refinery cover silhouettes — cylindrical pipe for half cover,
 * storage tank for full cover. Explicit rounded caps + rib bands so the
 * shapes read as industrial equipment instead of brick blocks.
 */
export function drawRefineryCover(
  g: Graphics, kind: TileKind,
  px: number, py: number, h: number, pal: TilePalette,
) {
  const left = px - 14, right = px + 14, top = py - h, bot = py;
  if (kind === 'cover_half') {
    const bodyTop = top + 1;
    const bodyBot = bot - 1;
    g.roundRect(left, bodyTop, 28, bodyBot - bodyTop, Math.min(6, (bodyBot - bodyTop) / 2))
      .fill({ color: pal.halfCover, alpha: 1 })
      .stroke({ color: pal.coverStroke, width: 1 });
    g.rect(left + 3, bodyTop + 1, 22, 1).fill({ color: pal.coverHighlight, alpha: 0.75 });
    g.rect(left + 3, bodyBot - 2, 22, 1).fill({ color: pal.coverShade, alpha: 0.65 });
    g.rect(left - 1, bodyTop - 1, 3, bodyBot - bodyTop + 2)
      .fill({ color: pal.coverShade, alpha: 0.9 })
      .stroke({ color: pal.coverStroke, width: 1 });
    g.rect(right - 2, bodyTop - 1, 3, bodyBot - bodyTop + 2)
      .fill({ color: pal.coverShade, alpha: 0.9 })
      .stroke({ color: pal.coverStroke, width: 1 });
  } else {
    g.rect(left - 1, top - 1, 30, h + 1)
      .fill({ color: pal.fullCover, alpha: 1 })
      .stroke({ color: pal.coverStroke, width: 1 });
    g.rect(left, top, 28, 2).fill({ color: pal.coverHighlight, alpha: 0.85 });
    for (const ry of [top + 5, top + Math.floor(h * 0.55), bot - 3]) {
      g.rect(left - 1, ry, 30, 1).fill({ color: pal.coverShade, alpha: 0.65 });
      g.rect(left - 1, ry + 1, 30, 0.5).fill({ color: pal.coverHighlight, alpha: 0.5 });
    }
    g.rect(right - 3, top + 2, 3, h - 3)
      .fill({ color: pal.coverShade, alpha: 0.55 });
    g.rect(left + 5, top + 3, 0.8, h - 5)
      .fill({ color: pal.halfCover, alpha: 0.7 });
    g.rect(left + 6, top + 8, 0.6, h - 10)
      .fill({ color: pal.wallStain, alpha: 0.65 });
    const plaqX = px - 2, plaqY = top + Math.floor(h * 0.3);
    g.rect(plaqX, plaqY, 4, 4).fill({ color: pal.wallHighlight, alpha: 0.85 });
    g.rect(plaqX + 1, plaqY + 1, 2, 2).fill({ color: pal.coverStroke, alpha: 0.95 });
  }
}

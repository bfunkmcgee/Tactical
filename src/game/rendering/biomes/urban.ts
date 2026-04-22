import type { PropDraw, TilePalette } from '../context';

/**
 * Urban biome — no shipping maps use it yet, but the renderer is prepared.
 * Cold steel-and-concrete palette; props/decals suggest a modern city.
 */
export const URBAN_PALETTE: TilePalette = {
  floor: [0x1b2331, 0x202a3c, 0x1a2230],
  floorStroke: 0x2a3447,
  wall: 0x0b0f14,
  wallHighlight: 0x1a2230,
  wallStain: 0x050709,
  halfCover: 0x3c5673,
  fullCover: 0x5a7498,
  coverHighlight: 0x7aa0c8,
  coverShade: 0x2e445c,
  coverStroke: 0x0b0f14,
  accent: 0x2a3447,
  accentLight: 0x465a7b,
  rimHighlight: 0x2f3d55,
};

// --- Urban props ----------------------------------------------------

const drawUrbanCrate: PropDraw = (g, cx, cy) => {
  const wood = 0x5a432a, dark = 0x1a0e08, rim = 0x8a6838;
  g.rect(cx - 3, cy - 3, 6, 5).fill({ color: wood }).stroke({ color: dark, width: 0.6 });
  g.rect(cx - 3, cy - 3, 6, 0.6).fill({ color: rim, alpha: 0.7 });
  g.moveTo(cx - 3, cy); g.lineTo(cx + 3, cy);
  g.stroke({ color: dark, width: 0.4 });
};

const drawUrbanTrash: PropDraw = (g, cx, cy) => {
  const bag = 0x1a1a22, shine = 0x4a4a58;
  g.ellipse(cx, cy, 4, 3).fill({ color: bag }).stroke({ color: shine, width: 0.4 });
  g.rect(cx - 0.5, cy - 4, 1, 1.5).fill({ color: bag });
};

const drawUrbanPaper: PropDraw = (g, cx, cy) => {
  const paper = 0xc0b8a0, dark = 0x3a3428;
  g.rect(cx - 3, cy - 1, 6, 3).fill({ color: paper, alpha: 0.85 });
  g.moveTo(cx - 2, cy); g.lineTo(cx + 2, cy);
  g.stroke({ color: dark, width: 0.3, alpha: 0.6 });
};

export const URBAN_PROPS: PropDraw[] = [drawUrbanCrate, drawUrbanTrash, drawUrbanPaper];

// --- Urban decals ---------------------------------------------------

const drawUrbanFootprint: PropDraw = (g, cx, cy) => {
  const dark = 0x0e0e14;
  g.ellipse(cx - 2, cy,     1.4, 2.4).fill({ color: dark, alpha: 0.55 });
  g.ellipse(cx + 2, cy + 3, 1.4, 2.4).fill({ color: dark, alpha: 0.55 });
};

const drawUrbanScorch: PropDraw = (g, cx, cy) => {
  g.ellipse(cx, cy, 5, 3).fill({ color: 0x050508, alpha: 0.65 });
  g.ellipse(cx, cy, 2.2, 1.2).fill({ color: 0x000000, alpha: 0.8 });
};

const drawUrbanGraffiti: PropDraw = (g, cx, cy) => {
  const paint = 0xc8384a;
  g.moveTo(cx - 3, cy); g.lineTo(cx + 3, cy);
  g.stroke({ color: paint, width: 0.9, alpha: 0.8 });
  g.moveTo(cx - 2, cy - 2); g.lineTo(cx + 2, cy + 2);
  g.stroke({ color: paint, width: 0.9, alpha: 0.8 });
};

const drawUrbanCrack: PropDraw = (g, cx, cy) => {
  const dark = 0x0a0a10;
  g.moveTo(cx - 4, cy);
  g.lineTo(cx - 1, cy + 1);
  g.lineTo(cx + 1, cy - 1);
  g.lineTo(cx + 4, cy);
  g.stroke({ color: dark, width: 0.7, alpha: 0.7 });
};

const drawUrbanCasings: PropDraw = (g, cx, cy) => {
  const brass = 0xd8a048;
  g.rect(cx - 2, cy,     1.6, 0.8).fill({ color: brass });
  g.rect(cx + 1, cy - 1, 1.6, 0.8).fill({ color: brass });
  g.rect(cx,     cy + 2, 1.6, 0.8).fill({ color: brass });
};

const drawUrbanCigarette: PropDraw = (g, cx, cy) => {
  const paper = 0xe8e0c0, tip = 0x8a4020;
  g.rect(cx - 2, cy, 3.5, 0.8).fill({ color: paper, alpha: 0.9 });
  g.rect(cx + 1.5, cy, 0.8, 0.8).fill({ color: tip });
};

const drawUrbanGum: PropDraw = (g, cx, cy) => {
  g.circle(cx, cy, 1.1).fill({ color: 0x2a2018, alpha: 0.8 });
  g.circle(cx - 2, cy + 1, 0.5).fill({ color: 0x2a2018, alpha: 0.6 });
};

const drawUrbanDragMark: PropDraw = (g, cx, cy) => {
  const dark = 0x1a1a22;
  g.moveTo(cx - 5, cy - 1); g.lineTo(cx + 5, cy + 1);
  g.stroke({ color: dark, width: 0.8, alpha: 0.7 });
  g.moveTo(cx - 5, cy + 1); g.lineTo(cx + 5, cy + 3);
  g.stroke({ color: dark, width: 0.8, alpha: 0.7 });
};

export const URBAN_DECALS: PropDraw[] = [
  drawUrbanFootprint, drawUrbanScorch, drawUrbanGraffiti, drawUrbanCrack,
  drawUrbanCasings, drawUrbanCigarette, drawUrbanGum, drawUrbanDragMark,
];

// --- Urban edge bumps -----------------------------------------------

const drawEdgeRubble: PropDraw = (g, cx, cy) => {
  g.ellipse(cx, cy + 4, 14, 2.5).fill({ color: 0x050709, alpha: 0.6 });
  g.poly([cx - 12, cy + 4, cx - 8, cy - 3, cx - 2, cy - 4, cx + 2, cy + 4])
    .fill({ color: 0x3c5673 }).stroke({ color: 0x0b0f14, width: 0.8 });
  g.poly([cx - 1, cy + 4, cx + 3, cy - 6, cx + 9, cy - 5, cx + 12, cy + 4])
    .fill({ color: 0x2e445c }).stroke({ color: 0x0b0f14, width: 0.8 });
};

export const EDGE_URBAN_RUBBLE: PropDraw[] = [drawEdgeRubble];

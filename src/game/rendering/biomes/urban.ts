import type { Graphics } from 'pixi.js';
import type { TileKind } from '../../types';
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

// --- Urban cover detail + variants ----------------------------------

/**
 * Default urban cover detail layered on the trapezoid silhouette.
 * Concrete-block reading: pale cap rim, dark joint lines, side shade,
 * graffiti-tagged warning stripe at the base. Mirrors the structural
 * approach desert uses (top sun ridge + side shade + contact shadow)
 * but with a colder palette + horizontal mortar joints.
 */
export function drawUrbanCoverDetail(
  g: Graphics, kind: TileKind,
  px: number, py: number, h: number, gx: number, gy: number, pal: TilePalette,
) {
  const left = px - 14, right = px + 14, top = py - h, bot = py;

  // Top cap — bright concrete rim + soft falloff.
  g.rect(left, top, 28, 1.4).fill({ color: pal.coverHighlight, alpha: 0.95 });
  g.rect(left, top + 1.4, 28, 0.8).fill({ color: pal.coverHighlight, alpha: 0.4 });

  // Right + left shade bands (matches desert's painted-volume look).
  g.rect(right - 2.5, top + 1.2, 2.5, h - 1.2)
    .fill({ color: pal.coverShade, alpha: 0.5 });
  g.rect(left, top + 1.2, 1.6, h - 1.2)
    .fill({ color: pal.coverHighlight, alpha: 0.18 });

  // Horizontal mortar joints — concrete blocks aren't continuous walls.
  for (let y = top + 4; y < bot; y += 5) {
    g.rect(left, y, 28, 0.5).fill({ color: pal.coverStroke, alpha: 0.65 });
  }

  // Per-tile vertical seam offset so adjacent blocks read as
  // independent slabs rather than a single wall stamp.
  const hash = ((gx * 31 + gy * 17) >>> 0);
  for (let i = 0, y = top + 4; y < bot; y += 5, i++) {
    const seamX = left + 4 + ((hash + i * 11) % 18);
    g.rect(seamX, y - 5, 0.5, 5).fill({ color: pal.coverStroke, alpha: 0.55 });
  }

  if (kind === 'cover_full') {
    // Mid-height grime band + concrete cap groove for a tall slab read.
    const mid = Math.round(top + h * 0.55);
    g.rect(left, mid, 28, 0.6).fill({ color: pal.wallStain, alpha: 0.7 });
  }

  // Contact shadow at the ground line.
  g.rect(left + 1, bot - 1, 26, 1).fill({ color: pal.coverStroke, alpha: 0.45 });
}

/**
 * Per-tile silhouette variants for ISOLATED urban cover blocks. Two
 * variants per kind, picked deterministically from the tile hash.
 * Connected blocks always fall through to the default trapezoid (so
 * wall extenders bridge cleanly).
 *
 * Pool:
 *   - cover_half: dumpster (~20%) / jersey barrier (~20%).
 *   - cover_full: vending machine (~20%) / phone kiosk (~20%).
 *   60% per kind falls through to the default concrete-block trapezoid.
 */
export function drawUrbanCoverVariant(
  g: Graphics, kind: TileKind,
  px: number, py: number, h: number, hash: number, _pal: TilePalette,
): 'drew' | 'default' {
  const bucket = (hash >>> 16) % 10;
  if (kind === 'cover_half') {
    if (bucket < 2) { drawUrbanDumpster(g, px, py, h); return 'drew'; }
    if (bucket < 4) { drawUrbanJerseyBarrier(g, px, py, h); return 'drew'; }
    return 'default';
  }
  if (kind === 'cover_full') {
    if (bucket < 2) { drawUrbanVendingMachine(g, px, py, h); return 'drew'; }
    if (bucket < 4) { drawUrbanKiosk(g, px, py, h); return 'drew'; }
    return 'default';
  }
  return 'default';
}

function drawUrbanDumpster(g: Graphics, px: number, py: number, h: number) {
  const body = 0x3a4858, bodyHi = 0x6a7a90, dark = 0x0a0e16, lid = 0x4a5a70;
  const left = px - 13, right = px + 13, top = py - h, bot = py;
  // Body — tapered top (slope-back lid).
  g.poly([left, bot, left + 1.5, top + 2, right - 1.5, top + 2, right, bot])
    .fill({ color: body }).stroke({ color: dark, width: 0.8 });
  // Lid — angled across the top.
  g.poly([left + 1.5, top + 2, right - 1.5, top + 2, right - 3, top, left + 3, top + 0.6])
    .fill({ color: lid }).stroke({ color: dark, width: 0.6 });
  // Lid sun-hit ridge.
  g.moveTo(left + 3, top + 0.6); g.lineTo(right - 3, top);
  g.stroke({ color: bodyHi, width: 1, alpha: 0.85 });
  // Side ribs (corrugation).
  for (const x of [px - 7, px, px + 7]) {
    g.rect(x - 0.3, top + 3, 0.6, h - 4).fill({ color: dark, alpha: 0.55 });
  }
  // Bottom drain notch.
  g.rect(left + 4, bot - 1.2, 4, 1.2).fill({ color: dark, alpha: 0.85 });
  g.rect(right - 8, bot - 1.2, 4, 1.2).fill({ color: dark, alpha: 0.85 });
  // Right-side shade.
  g.rect(right - 3, top + 2.5, 2, h - 4).fill({ color: dark, alpha: 0.4 });
  // Contact shadow.
  g.rect(left + 1, bot - 0.5, 26, 0.8).fill({ color: 0x000000, alpha: 0.4 });
}

function drawUrbanJerseyBarrier(g: Graphics, px: number, py: number, h: number) {
  const concrete = 0x9aa6b6, concreteDark = 0x4a5666, concreteHi = 0xc8d2e0;
  const reflectiveYellow = 0xe8c468;
  const dark = 0x0a0e16;
  const left = px - 13, right = px + 13, top = py - h, bot = py;
  // Trapezoidal cross-section — wider at the base, narrower at the cap.
  g.poly([left, bot, left + 4, top + 2, right - 4, top + 2, right, bot])
    .fill({ color: concrete }).stroke({ color: dark, width: 0.7 });
  // Top cap.
  g.rect(left + 4, top, right - left - 8, 2.4).fill({ color: concrete }).stroke({ color: dark, width: 0.6 });
  // Sun-hit highlight along the top ridge.
  g.rect(left + 4.5, top + 0.4, right - left - 9, 0.8).fill({ color: concreteHi, alpha: 0.85 });
  // Reflective yellow stripe.
  g.rect(left + 5, top + 3.5, right - left - 10, 1.2)
    .fill({ color: reflectiveYellow, alpha: 0.85 });
  // Dirt + tire-rubber smudges along the lower face.
  g.rect(left + 3, bot - 4, right - left - 6, 0.6).fill({ color: concreteDark, alpha: 0.5 });
  g.rect(left + 5, bot - 1.2, right - left - 10, 0.5).fill({ color: dark, alpha: 0.55 });
  // Right-side shade.
  g.poly([right - 4, top + 2, right, bot, right - 2, bot, right - 4, top + 4])
    .fill({ color: concreteDark, alpha: 0.45 });
  // Contact shadow.
  g.rect(left + 1, bot - 0.5, 26, 0.8).fill({ color: 0x000000, alpha: 0.4 });
}

function drawUrbanVendingMachine(g: Graphics, px: number, py: number, h: number) {
  const body = 0x9a3030, bodyHi = 0xc85060, bodyDark = 0x4a1010;
  const glass = 0x102030, glassHi = 0x405680;
  const dark = 0x0a0e16, light = 0xc8d2e0;
  const left = px - 11, right = px + 11, top = py - h, bot = py;
  // Cabinet body.
  g.rect(left, top + 1, 22, h - 1).fill({ color: body }).stroke({ color: dark, width: 0.8 });
  // Top sign band.
  g.rect(left, top + 1, 22, 3).fill({ color: bodyDark }).stroke({ color: dark, width: 0.5 });
  g.rect(left + 1, top + 1.5, 20, 0.6).fill({ color: bodyHi, alpha: 0.85 });
  // Display window (glass panel showing bottles).
  g.rect(left + 2, top + 5, 18, h * 0.45)
    .fill({ color: glass }).stroke({ color: dark, width: 0.6 });
  // Faint internal shelves + bottle silhouettes.
  for (const sy of [top + 8, top + 12, top + 16].filter((y) => y < top + 5 + h * 0.45 - 2)) {
    g.rect(left + 3, sy, 16, 0.4).fill({ color: glassHi, alpha: 0.6 });
  }
  for (const cx of [left + 5, left + 9, left + 13, left + 17]) {
    g.rect(cx - 0.7, top + 6, 1.4, 3).fill({ color: bodyHi, alpha: 0.7 });
  }
  // Selection panel (lower half).
  const panelTop = top + 5 + Math.floor(h * 0.45) + 1;
  g.rect(left + 2, panelTop, 18, bot - panelTop - 3)
    .fill({ color: bodyDark }).stroke({ color: dark, width: 0.5 });
  // Coin slot + dispenser tray.
  g.rect(right - 5, panelTop + 2, 3, 1).fill({ color: dark });
  g.rect(left + 3, bot - 3, 16, 2).fill({ color: dark, alpha: 0.7 });
  // Sun-hit ridge.
  g.rect(left, top + 1, 22, 0.8).fill({ color: bodyHi, alpha: 0.7 });
  // Right shade band.
  g.rect(right - 1.6, top + 1, 1.6, h - 1).fill({ color: dark, alpha: 0.45 });
  // LED dot for "in service" cue.
  g.circle(left + 4, panelTop + 3, 0.6).fill({ color: light, alpha: 0.85 });
  g.rect(left + 1, bot - 0.5, 22, 0.8).fill({ color: 0x000000, alpha: 0.4 });
}

function drawUrbanKiosk(g: Graphics, px: number, py: number, h: number) {
  const frame = 0x202a3c, frameHi = 0x405680;
  const glass = 0x142030, glassHi = 0x6a8aa8;
  const roof = 0x3a4858, roofHi = 0x7a8aa0;
  const dark = 0x0a0e16;
  const left = px - 12, right = px + 12, top = py - h, bot = py;
  // Roof — slight overhang.
  g.rect(left - 1, top, 26, 3.5).fill({ color: roof }).stroke({ color: dark, width: 0.7 });
  g.rect(left - 1, top, 26, 1).fill({ color: roofHi, alpha: 0.85 });
  // Body — frame around three glass panels.
  g.rect(left, top + 3.5, 24, h - 3.5).fill({ color: frame }).stroke({ color: dark, width: 0.7 });
  // Glass panes — front centre + two sides.
  g.rect(left + 2, top + 5, 20, h - 9)
    .fill({ color: glass }).stroke({ color: dark, width: 0.5 });
  // Internal vertical mullions.
  g.rect(left + 8, top + 5, 0.6, h - 9).fill({ color: frame });
  g.rect(left + 15, top + 5, 0.6, h - 9).fill({ color: frame });
  // Glass reflections (sun spilling onto NE pane).
  g.rect(left + 3, top + 5.5, 4, h - 11).fill({ color: glassHi, alpha: 0.35 });
  g.rect(left + 16, top + 5.5, 5, 2).fill({ color: glassHi, alpha: 0.5 });
  // Door handle.
  g.rect(right - 4, top + Math.floor(h * 0.6), 0.8, 2).fill({ color: frameHi });
  // Bottom plinth.
  g.rect(left, bot - 3, 24, 3).fill({ color: frame });
  g.rect(left, bot - 3, 24, 0.6).fill({ color: frameHi, alpha: 0.6 });
  // Right shade.
  g.rect(right - 1.6, top + 4, 1.6, h - 4).fill({ color: dark, alpha: 0.45 });
  // Contact shadow.
  g.rect(left, bot - 0.5, 24, 0.8).fill({ color: 0x000000, alpha: 0.4 });
}

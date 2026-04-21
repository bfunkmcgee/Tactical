import type { GridMap, Tile, TileKind } from '../types';

// 16×12 layout of the old Eldersands refinery. Rusted storage tanks form
// full-cover clusters through the middle; pipe runs stitch between them
// as half cover; a rear catwalk holds the Choir leadership (T).
//
// The map reuses the abstract spawn legend (G / O / T) so the pack's
// `spawnLegend` resolves the enemy templates — Rust Choir by default.
//
// Legend:
//  .  floor       #  wall
//  h  half cover  H  full cover  (pipe run / storage tank)
//  P  player spawn
//  G/O/T enemy spawn keys
const ASCII = [
  '################',
  '#P.h.......h..G#',
  '#P.h...H...h..O#',
  '#..h.H...H.h...#',
  '#P....h.h......#',
  '#...H.h.h.H.h.G#',
  '#...H.h.h.H.h..#',
  '#P....h.h......#',
  '#..h.H...H.h...#',
  '#..h.......h..T#',
  '#..h.......h..O#',
  '################',
];

const SPAWN_KEYS = new Set(['G', 'O', 'T']);

function classify(ch: string): { kind: TileKind; spawn?: 'P' | string } {
  switch (ch) {
    case '#': return { kind: 'wall' };
    case 'h': return { kind: 'cover_half' };
    case 'H': return { kind: 'cover_full' };
    case 'P': return { kind: 'floor', spawn: 'P' };
    default:
      if (SPAWN_KEYS.has(ch)) return { kind: 'floor', spawn: ch };
      return { kind: 'floor' };
  }
}

function build(): GridMap {
  const height = ASCII.length;
  const width = ASCII[0].length;
  const tiles: Tile[] = new Array(width * height);
  const playerSpawns: GridMap['playerSpawns'] = [];
  const enemySpawns: GridMap['enemySpawns'] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const c = ASCII[y][x];
      const { kind, spawn } = classify(c);
      tiles[y * width + x] = { kind, variant: ((x * 11 + y * 7) % 3) };
      if (spawn === 'P') playerSpawns.push({ x, y });
      else if (spawn) enemySpawns.push({ pos: { x, y }, spawnKey: spawn });
    }
  }
  return {
    id: 'desert_refinery', name: 'Eldersands Refinery',
    tileset: 'desert-refinery',
    width, height, tiles, playerSpawns, enemySpawns,
  };
}

export const DESERT_REFINERY: GridMap = build();

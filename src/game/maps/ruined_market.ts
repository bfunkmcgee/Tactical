import type { GridMap, Tile, TileKind } from '../types';

// Compact ASCII map. 16x12 for mobile-friendly proportions.
//
// Spawn keys are abstract — the active ContentPack's `spawnLegend` resolves
// them to enemy template ids at deploy time, so the same map can host
// different factions across packs.
//
// Legend:
//  .  floor       #  wall
//  h  half cover  H  full cover
//  P  player spawn
//  G  spawn key 'G' (e.g. common grunt)
//  O  spawn key 'O' (e.g. uncommon mid-tier)
//  T  spawn key 'T' (e.g. rare elite)
const ASCII = [
  '################',
  '#P..h......h..G#',
  '#..H....h....H.#',
  '#P...h....H...G#',
  '#......hh......#',
  '#..h........H..#',
  '#....HH....h...#',
  '#P.........h..T#',
  '#..h....hh....h#',
  '#....H.......H.#',
  '#P..........h.O#',
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
      tiles[y * width + x] = { kind, variant: ((x * 7 + y * 13) % 3) };
      if (spawn === 'P') playerSpawns.push({ x, y });
      else if (spawn) enemySpawns.push({ pos: { x, y }, spawnKey: spawn });
    }
  }
  return { id: 'ruined_market', name: 'Ruined Market', width, height, tiles, playerSpawns, enemySpawns };
}

export const RUINED_MARKET: GridMap = build();

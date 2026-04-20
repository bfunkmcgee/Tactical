import type { GridMap, Tile, TileKind } from '../types';

// Long nave flanked by paired pillars (full cover) and two pew rows (half
// cover); altar at the south end. Spawn keys are pack-agnostic — the active
// ContentPack's `spawnLegend` resolves them to enemy template ids at deploy.
//
// Legend:
//  .  floor       #  wall
//  h  half cover  H  full cover
//  P  player spawn
//  G  spawn key 'G' · common grunt
//  O  spawn key 'O' · uncommon mid-tier
//  T  spawn key 'T' · rare elite (war-priest)
const ASCII = [
  '################',
  '#.P.H......H.P.#',
  '#..H........H..#',
  '#..............#',
  '#..hhh....hhh..#',
  '#.G.H......H.G.#',
  '#..hhhh..hhhh..#',
  '#..H........H..#',
  '#P...G.O..G...P#',
  '#....HHHHH.....#',
  '#....H.T.H.....#',
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
      tiles[y * width + x] = { kind, variant: (x + y) % 3 };
      if (spawn === 'P') playerSpawns.push({ x, y });
      else if (spawn) enemySpawns.push({ pos: { x, y }, spawnKey: spawn });
    }
  }
  return { id: 'rust_chapel', name: 'Rust Chapel', width, height, tiles, playerSpawns, enemySpawns };
}

export const RUST_CHAPEL: GridMap = build();

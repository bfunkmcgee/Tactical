import type { GridMap, Tile, TileKind } from '../types';

// 16×12 fortified approach to the refinery. Two twin scrap-iron
// watchtowers (2×2 full-cover blocks) bracket a narrow gate corridor
// with sandbag positions down the middle. The gate guard (T) hunkers
// at the rear between the southern towers.
//
// Mission 3 of Refinery Raid — crack the last obstacle before the
// refinery proper.
const ASCII = [
  '################',
  '#P...........G.#',
  '#P.............#',
  '#P....HH.HH....#',
  '#.....HH.HH..O.#',
  '#.....h...h....#',
  '#.....h...h....#',
  '#.....h...h..O.#',
  '#.....HH.HH....#',
  '#.....HH.HH..T.#',
  '#..............#',
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
      tiles[y * width + x] = { kind, variant: ((x * 7 + y * 3) % 3) };
      if (spawn === 'P') playerSpawns.push({ x, y });
      else if (spawn) enemySpawns.push({ pos: { x, y }, spawnKey: spawn });
    }
  }
  return {
    id: 'gate_watch', name: 'Gate Watch',
    tileset: 'desert',
    width, height, tiles, playerSpawns, enemySpawns,
  };
}

export const GATE_WATCH: GridMap = build();

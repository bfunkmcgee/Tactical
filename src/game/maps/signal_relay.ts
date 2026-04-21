import type { GridMap, Tile, TileKind } from '../types';

// 16×12 hilltop signal relay outpost. Two sandbag emplacements flank
// a central scrap-iron transmission tower (full-cover cluster). The
// Choir runners hold the tower while their comms officer squats by
// the gear at the rear (T).
//
// Opens the Refinery Raid excursion: knock the relay offline before
// it can ping the refinery.
const ASCII = [
  '################',
  '#P...........G.#',
  '#P.............#',
  '#P.hhh....hhh..#',
  '#P.h.h....h.h.O#',
  '#..h.h....h.h..#',
  '#..hhh....hhh..#',
  '#......HH......#',
  '#.....H..H....G#',
  '#......HH.....T#',
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
      tiles[y * width + x] = { kind, variant: ((x * 5 + y * 13) % 3) };
      if (spawn === 'P') playerSpawns.push({ x, y });
      else if (spawn) enemySpawns.push({ pos: { x, y }, spawnKey: spawn });
    }
  }
  return {
    id: 'signal_relay', name: 'Signal Relay',
    tileset: 'desert',
    width, height, tiles, playerSpawns, enemySpawns,
  };
}

export const SIGNAL_RELAY: GridMap = build();

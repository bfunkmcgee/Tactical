import type { GridMap, Tile, TileKind } from '../types';

// 16×12 collapsed oasis. A dry well-shaft (thick full-cover column
// through the middle) anchors the map; half-cover ringstones surround
// it; lone boulders (H) scatter the approach. Wide open lanes make
// range matter — Kestrel and Seraphine eat here.
//
// Mission 2 of Refinery Raid: mop up the Choir survivors who fell
// back to the oasis after losing their relay.
const ASCII = [
  '################',
  '#P......H.....G#',
  '#P............G#',
  '#P......h......#',
  '#P...hHHh.h....#',
  '#....hHHh......#',
  '#....hHHh....O.#',
  '#....hHHh......#',
  '#........h.....#',
  '#......H......T#',
  '#.H...........O#',
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
      tiles[y * width + x] = { kind, variant: ((x * 3 + y * 11) % 3) };
      if (spawn === 'P') playerSpawns.push({ x, y });
      else if (spawn) enemySpawns.push({ pos: { x, y }, spawnKey: spawn });
    }
  }
  return {
    id: 'dry_well', name: 'Dry Well',
    tileset: 'desert',
    width, height, tiles, playerSpawns, enemySpawns,
  };
}

export const DRY_WELL: GridMap = build();

import type { GridMap, Tile, TileKind } from '../../types';

// Compact ASCII map. 16x12 for mobile-friendly proportions.
// Legend:
//  .  floor
//  #  wall
//  h  half cover
//  H  full cover
//  P  player spawn (floor)
//  R  wraith raider spawn (floor)
//  T  gutter troll spawn (floor)
const ASCII = [
  '################',
  '#P..h......h..R#',
  '#..H....h....H.#',
  '#P...h....H....#',
  '#......hh......#',
  '#..h........H..#',
  '#....HH....h...#',
  '#P.........h..T#',
  '#..h....hh....h#',
  '#....H.......H.#',
  '#P..........h.R#',
  '################',
];

function classify(ch: string): { kind: TileKind; spawn?: 'P' | 'R' | 'T' } {
  switch (ch) {
    case '#': return { kind: 'wall' };
    case 'h': return { kind: 'cover_half' };
    case 'H': return { kind: 'cover_full' };
    case 'P': return { kind: 'floor', spawn: 'P' };
    case 'R': return { kind: 'floor', spawn: 'R' };
    case 'T': return { kind: 'floor', spawn: 'T' };
    default:  return { kind: 'floor' };
  }
}

function build(): GridMap {
  const height = ASCII.length;
  const width = ASCII[0].length;
  const tiles: Tile[] = new Array(width * height);
  const playerSpawns = [];
  const enemySpawns: GridMap['enemySpawns'] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const c = ASCII[y][x];
      const { kind, spawn } = classify(c);
      tiles[y * width + x] = { kind, variant: ((x * 7 + y * 13) % 3) };
      if (spawn === 'P') playerSpawns.push({ x, y });
      if (spawn === 'R') enemySpawns.push({ pos: { x, y }, enemyId: 'wraith_raider' });
      if (spawn === 'T') enemySpawns.push({ pos: { x, y }, enemyId: 'gutter_troll' });
    }
  }
  return { id: 'ruined_market', name: 'Ruined Market', width, height, tiles, playerSpawns, enemySpawns };
}

export const RUINED_MARKET: GridMap = build();

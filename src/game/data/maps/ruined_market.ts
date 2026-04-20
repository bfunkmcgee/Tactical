import type { GridMap, Tile, TileKind } from '../../types';

// Compact ASCII map. 16x12 for mobile-friendly proportions.
// Legend:
//  .  floor
//  #  wall
//  h  half cover
//  H  full cover
//  P  player spawn (floor)
//  G  Rust Goblin spawn (common)
//  O  Rust Orc spawn (rare)
//  T  Rust Troll spawn (very rare; one per mission)
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

function classify(ch: string): { kind: TileKind; spawn?: 'P' | 'G' | 'O' | 'T' } {
  switch (ch) {
    case '#': return { kind: 'wall' };
    case 'h': return { kind: 'cover_half' };
    case 'H': return { kind: 'cover_full' };
    case 'P': return { kind: 'floor', spawn: 'P' };
    case 'G': return { kind: 'floor', spawn: 'G' };
    case 'O': return { kind: 'floor', spawn: 'O' };
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
      if (spawn === 'G') enemySpawns.push({ pos: { x, y }, enemyId: 'rust_goblin' });
      if (spawn === 'O') enemySpawns.push({ pos: { x, y }, enemyId: 'rust_orc' });
      if (spawn === 'T') enemySpawns.push({ pos: { x, y }, enemyId: 'rust_troll' });
    }
  }
  return { id: 'ruined_market', name: 'Ruined Market', width, height, tiles, playerSpawns, enemySpawns };
}

export const RUINED_MARKET: GridMap = build();

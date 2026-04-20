import type { GridMap, Tile, TileKind } from '../../types';

// Rust Chapel — a ruined choir hall deep in Rust Choir territory.
// Long nave flanked by pillars (full cover), two rows of pews (half cover),
// and an altar at the far end where the troll war-priest stands.
//
// Legend:
//  .  floor       #  wall
//  h  half cover  H  full cover
//  P  player spawn
//  G  Rust Goblin spawn    O  Rust Orc spawn    T  Rust Troll spawn
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
      // Regular repeating tile pattern evokes the aligned flagstones of a nave.
      tiles[y * width + x] = { kind, variant: (x + y) % 3 };
      if (spawn === 'P') playerSpawns.push({ x, y });
      if (spawn === 'G') enemySpawns.push({ pos: { x, y }, enemyId: 'rust_goblin' });
      if (spawn === 'O') enemySpawns.push({ pos: { x, y }, enemyId: 'rust_orc' });
      if (spawn === 'T') enemySpawns.push({ pos: { x, y }, enemyId: 'rust_troll' });
    }
  }
  return { id: 'rust_chapel', name: 'Rust Chapel', width, height, tiles, playerSpawns, enemySpawns };
}

export const RUST_CHAPEL: GridMap = build();

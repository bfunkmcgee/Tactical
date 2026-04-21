import type { GridMap, Vec2 } from '../types';
import { isWalkable, keyOf } from '../engine/grid';

const NEIGHBORS_4: Vec2[] = [
  { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
];

/**
 * Static reachability check: flood-fills the walkable floor/half-cover tiles
 * starting from every player spawn, then reports any enemy spawn that sits
 * outside that flood. Catches maps where an enemy is entirely boxed in by
 * walls or cover_full (unreachable AND untargetable via LOS through
 * cover_full), which would stall "eliminate all" missions.
 *
 * Returns a list of human-readable warnings. Maps without warnings return [].
 * Callers typically `console.warn` each entry; tests can assert length===0.
 */
export function validateMapReachability(m: GridMap): string[] {
  const warnings: string[] = [];
  const visited = new Set<number>();
  const queue: Vec2[] = [];
  for (const p of m.playerSpawns) {
    if (!isWalkable(m, p.x, p.y)) {
      warnings.push(`[map ${m.id}] player spawn at (${p.x},${p.y}) is not walkable`);
      continue;
    }
    const k = keyOf(p.x, p.y);
    if (!visited.has(k)) { visited.add(k); queue.push(p); }
  }
  while (queue.length) {
    const cur = queue.shift()!;
    for (const d of NEIGHBORS_4) {
      const nx = cur.x + d.x, ny = cur.y + d.y;
      if (!isWalkable(m, nx, ny)) continue;
      const nk = keyOf(nx, ny);
      if (visited.has(nk)) continue;
      visited.add(nk);
      queue.push({ x: nx, y: ny });
    }
  }
  for (const es of m.enemySpawns) {
    if (!isWalkable(m, es.pos.x, es.pos.y)) {
      warnings.push(`[map ${m.id}] enemy spawn at (${es.pos.x},${es.pos.y}) is not walkable`);
      continue;
    }
    if (!visited.has(keyOf(es.pos.x, es.pos.y))) {
      warnings.push(`[map ${m.id}] enemy spawn at (${es.pos.x},${es.pos.y}) is unreachable from any player spawn — fully enclosed by walls / cover_full`);
    }
  }
  return warnings;
}

import type { GridMap, Vec2 } from '../types';
import { inBounds, isWalkable, manhattan, keyOf } from './grid';

const NEIGHBORS_4: Vec2[] = [
  { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
];

type Node = { x: number; y: number; g: number; f: number };

function pushHeap(h: Node[], n: Node) {
  h.push(n);
  let i = h.length - 1;
  while (i > 0) {
    const p = (i - 1) >> 1;
    if (h[p].f <= h[i].f) break;
    [h[p], h[i]] = [h[i], h[p]];
    i = p;
  }
}
function popHeap(h: Node[]): Node {
  const top = h[0];
  const last = h.pop()!;
  if (h.length > 0) {
    h[0] = last;
    let i = 0;
    for (;;) {
      const l = i * 2 + 1, r = l + 1;
      let best = i;
      if (l < h.length && h[l].f < h[best].f) best = l;
      if (r < h.length && h[r].f < h[best].f) best = r;
      if (best === i) break;
      [h[best], h[i]] = [h[i], h[best]];
      i = best;
    }
  }
  return top;
}

/** A* 4-way. Returns path including start and goal, or null if unreachable. */
export function findPath(
  m: GridMap,
  start: Vec2,
  goal: Vec2,
  blocked: ReadonlySet<number> = new Set()
): Vec2[] | null {
  if (!inBounds(m, start.x, start.y) || !inBounds(m, goal.x, goal.y)) return null;
  if (!isWalkable(m, goal.x, goal.y)) return null;
  if (start.x === goal.x && start.y === goal.y) return [start];

  const open: Node[] = [];
  const cameFrom = new Map<number, number>(); // child -> parent key
  const gScore = new Map<number, number>();
  const startKey = keyOf(start.x, start.y);
  gScore.set(startKey, 0);
  pushHeap(open, { x: start.x, y: start.y, g: 0, f: manhattan(start, goal) });

  while (open.length) {
    const cur = popHeap(open);
    if (cur.x === goal.x && cur.y === goal.y) {
      const path: Vec2[] = [{ x: cur.x, y: cur.y }];
      let k = keyOf(cur.x, cur.y);
      while (cameFrom.has(k)) {
        k = cameFrom.get(k)!;
        path.push({ x: k % 4096, y: Math.floor(k / 4096) });
      }
      return path.reverse();
    }
    const curKey = keyOf(cur.x, cur.y);
    if (cur.g > (gScore.get(curKey) ?? Infinity)) continue;
    for (const d of NEIGHBORS_4) {
      const nx = cur.x + d.x, ny = cur.y + d.y;
      if (!isWalkable(m, nx, ny)) continue;
      const nk = keyOf(nx, ny);
      if (blocked.has(nk) && !(nx === goal.x && ny === goal.y)) continue;
      const ng = cur.g + 1;
      if (ng < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, ng);
        cameFrom.set(nk, curKey);
        pushHeap(open, { x: nx, y: ny, g: ng, f: ng + manhattan({ x: nx, y: ny }, goal) });
      }
    }
  }
  return null;
}

/** Flood-fill reachable tiles within maxSteps. Returns tile key -> steps. */
export function reachable(
  m: GridMap,
  start: Vec2,
  maxSteps: number,
  blocked: ReadonlySet<number> = new Set()
): Map<number, number> {
  const out = new Map<number, number>();
  if (maxSteps < 0) return out;
  const startKey = keyOf(start.x, start.y);
  out.set(startKey, 0);
  const queue: Array<{ x: number; y: number; d: number }> = [{ x: start.x, y: start.y, d: 0 }];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur.d === maxSteps) continue;
    for (const dir of NEIGHBORS_4) {
      const nx = cur.x + dir.x, ny = cur.y + dir.y;
      if (!isWalkable(m, nx, ny)) continue;
      const nk = keyOf(nx, ny);
      if (blocked.has(nk)) continue;
      if (out.has(nk)) continue;
      out.set(nk, cur.d + 1);
      queue.push({ x: nx, y: ny, d: cur.d + 1 });
    }
  }
  return out;
}

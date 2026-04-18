import type { GridMap, Unit, Vec2 } from '../types';
import { chebyshev, keyOf } from './grid';
import { findPath, reachable } from './pathing';
import { hasLineOfSight, getCoverState } from './los';

export type AiIntent =
  | { kind: 'move'; path: Vec2[] }
  | { kind: 'attack'; target: Unit; approach?: Vec2[] }
  | { kind: 'wait' };

/** Blocked set = every unit position except the acting unit. */
function blockedByUnits(actor: Unit, units: Unit[]): Set<number> {
  const out = new Set<number>();
  for (const u of units) if (u.alive && u.id !== actor.id) out.add(keyOf(u.pos.x, u.pos.y));
  return out;
}

export function decide(map: GridMap, actor: Unit, allUnits: Unit[]): AiIntent {
  const enemies = allUnits.filter((u) => u.faction === 'player' && u.alive);
  if (enemies.length === 0) return { kind: 'wait' };
  const blocked = blockedByUnits(actor, allUnits);

  // 1) If any enemy in LOS and in range, shoot the best-hit-chance target.
  const shootable = enemies
    .filter((e) => chebyshev(actor.pos, e.pos) <= (actor.mobility > 0 ? 12 : 6))
    .filter((e) => hasLineOfSight(map, actor.pos, e.pos));
  if (actor.ap >= 1 && shootable.length > 0) {
    const best = shootable.reduce((b, e) => {
      const bc = getCoverState(map, actor.pos, b.pos);
      const ec = getCoverState(map, actor.pos, e.pos);
      const score = (c: typeof bc) => (c === 'full' ? 0 : c === 'half' ? 1 : 2);
      return score(ec) > score(bc) ? e : b;
    }, shootable[0]);
    return { kind: 'attack', target: best };
  }

  // 2) Otherwise move toward the nearest enemy up to our movement budget.
  const nearest = enemies.reduce((b, e) =>
    chebyshev(actor.pos, e.pos) < chebyshev(actor.pos, b.pos) ? e : b,
  enemies[0]);

  const maxSteps = actor.mobility * actor.ap;
  if (maxSteps <= 0) return { kind: 'wait' };
  const reach = reachable(map, actor.pos, maxSteps, blocked);

  // Pick the reachable tile closest to the nearest enemy, tie-break by
  // preferring tiles adjacent to cover for ranged units.
  let bestKey = -1;
  let bestScore = Infinity;
  for (const [k] of reach) {
    const x = k % 4096, y = Math.floor(k / 4096);
    if (x === actor.pos.x && y === actor.pos.y) continue;
    const d = chebyshev({ x, y }, nearest.pos);
    if (d < bestScore) { bestScore = d; bestKey = k; }
  }
  if (bestKey < 0) return { kind: 'wait' };
  const goal = { x: bestKey % 4096, y: Math.floor(bestKey / 4096) };
  const path = findPath(map, actor.pos, goal, blocked);
  if (!path) return { kind: 'wait' };
  return { kind: 'move', path };
}

import type { GridMap, Unit, Vec2, CoverState } from '../types';
import { chebyshev, keyOf } from './grid';
import { findPath, reachable } from './pathing';
import { hasLineOfSight, getCoverState } from './los';

export type AiIntent =
  | { kind: 'move'; path: Vec2[] }
  | { kind: 'attack'; target: Unit }
  | { kind: 'wait' };

function blockedByUnits(actor: Unit, units: Unit[]): Set<number> {
  const out = new Set<number>();
  for (const u of units) if (u.alive && u.id !== actor.id) out.add(keyOf(u.pos.x, u.pos.y));
  return out;
}

const coverScore = (c: CoverState) => (c === 'full' ? 2 : c === 'half' ? 1 : 0);

/**
 * Utility-scored decision tree. A low-HP unit that is already in decent cover
 * prefers to hold; otherwise it shoots a visible player if possible, then
 * advances toward the nearest player, biased toward tiles adjacent to cover.
 */
export function decide(
  map: GridMap,
  actor: Unit,
  allUnits: Unit[],
  smokeTiles?: ReadonlySet<number>
): AiIntent {
  const enemies = allUnits.filter((u) => u.faction === 'player' && u.alive);
  if (enemies.length === 0) return { kind: 'wait' };
  const blocked = blockedByUnits(actor, allUnits);

  // 1) If any player is in LOS and within our weapon range, prefer to shoot.
  if (actor.ap >= 1) {
    const shootable = enemies
      .filter((e) => chebyshev(actor.pos, e.pos) <= actor.rangeLong)
      .filter((e) => hasLineOfSight(map, actor.pos, e.pos, smokeTiles));
    if (shootable.length > 0) {
      const best = shootable.reduce((b, e) => {
        const bc = coverScore(getCoverState(map, actor.pos, b.pos));
        const ec = coverScore(getCoverState(map, actor.pos, e.pos));
        // Prefer less-covered targets (higher hit chance); tie-break by closer distance.
        if (ec < bc) return e;
        if (ec > bc) return b;
        return chebyshev(actor.pos, e.pos) < chebyshev(actor.pos, b.pos) ? e : b;
      }, shootable[0]);
      return { kind: 'attack', target: best };
    }
  }

  // 2) Low-HP and already in cover? Hold position rather than break from it.
  // Melee attackers (berserkers) skip this — their whole identity is
  // closing to range 1, so we don't want them freezing at half-cover
  // when wounded.
  const isMelee = actor.rangeLong <= 1;
  const woundedThreshold = actor.hpMax * 0.4;
  if (!isMelee && actor.hp <= woundedThreshold) {
    // "Cover" here just means at least one adjacent wall or cover tile — enough
    // to give us a directional shield against the average player.
    const shield = ['wall', 'cover_full', 'cover_half'] as const;
    const hasShield = ([
      { x: actor.pos.x + 1, y: actor.pos.y },
      { x: actor.pos.x - 1, y: actor.pos.y },
      { x: actor.pos.x, y: actor.pos.y + 1 },
      { x: actor.pos.x, y: actor.pos.y - 1 },
    ] as const).some((p) => {
      const idx = p.y * map.width + p.x;
      const t = map.tiles[idx];
      return t && (shield as readonly string[]).includes(t.kind);
    });
    if (hasShield) return { kind: 'wait' };
  }

  // 3) Otherwise advance toward the nearest player.
  const nearest = enemies.reduce((b, e) =>
    chebyshev(actor.pos, e.pos) < chebyshev(actor.pos, b.pos) ? e : b,
  enemies[0]);

  const maxSteps = actor.mobility * actor.ap;
  if (maxSteps <= 0) return { kind: 'wait' };
  const reach = reachable(map, actor.pos, maxSteps, blocked);

  // Score each reachable tile: minimise distance to target, then prefer tiles
  // adjacent to cover (so ranged enemies don't sprint into the open).
  let bestKey = -1;
  let bestScore = Infinity;
  for (const [k] of reach) {
    const x = k % 4096, y = Math.floor(k / 4096);
    if (x === actor.pos.x && y === actor.pos.y) continue;
    const d = chebyshev({ x, y }, nearest.pos);
    const coverAdj = (['cover_full', 'cover_half', 'wall'] as const).some((kind) =>
      [{ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 }]
        .some((p) => map.tiles[p.y * map.width + p.x]?.kind === kind)
    );
    // 10-tile penalty for tiles without adjacent cover keeps ranged enemies
    // tucked against walls; at equal distance the covered tile wins.
    const score = d + (coverAdj ? 0 : 0.5);
    if (score < bestScore) { bestScore = score; bestKey = k; }
  }
  if (bestKey < 0) return { kind: 'wait' };
  const goal = { x: bestKey % 4096, y: Math.floor(bestKey / 4096) };
  const path = findPath(map, actor.pos, goal, blocked);
  if (!path) return { kind: 'wait' };
  return { kind: 'move', path };
}

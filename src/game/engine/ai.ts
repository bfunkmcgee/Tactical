import type { GridMap, Unit, Vec2, CoverState } from '../types';
import { chebyshev, keyOf } from './grid';
import { findPath, reachable } from './pathing';
import { hasLineOfSight, getCoverState } from './los';

export type AiIntent =
  | { kind: 'move'; path: Vec2[] }
  | { kind: 'attack'; target: Unit }
  /**
   * Overwatch: spend the rest of the turn watching a chokepoint. The
   * renderer renders the gold pip above the head; player movement
   * through a watched tile triggers a reactive shot on the enemy side
   * (mirrors the player overwatch path).
   */
  | { kind: 'overwatch' }
  /**
   * Lob a grenade at `center`. Enemy templates declare their blast
   * stats via the optional `grenade` field; no per-enemy loadout
   * needed. Resolution reuses the player grenade math.
   */
  | { kind: 'throw'; center: Vec2 }
  | { kind: 'wait' };

function blockedByUnits(actor: Unit, units: Unit[]): Set<number> {
  const out = new Set<number>();
  for (const u of units) if (u.alive && u.id !== actor.id) out.add(keyOf(u.pos.x, u.pos.y));
  return out;
}

const coverScore = (c: CoverState) => (c === 'full' ? 2 : c === 'half' ? 1 : 0);

export interface AiGrenade {
  dmgMin: number;
  dmgMax: number;
  radius: number;  // chebyshev blast radius
  range: number;   // chebyshev max throw distance
}

/**
 * Utility-scored decision tree. Priority order:
 *   1. Throw a grenade at a 2+ player cluster (if we have grenades).
 *   2. Shoot a visible player in weapon range.
 *   3. Low-HP + cover → hold.
 *   4. Set overwatch if a player is approaching but not yet in range.
 *   5. Advance toward the nearest player.
 *   6. Wait.
 */
export function decide(
  map: GridMap,
  actor: Unit,
  allUnits: Unit[],
  smokeTiles?: ReadonlySet<number>,
  grenade?: AiGrenade,
): AiIntent {
  const enemies = allUnits.filter((u) => u.faction === 'player' && u.alive);
  if (enemies.length === 0) return { kind: 'wait' };
  const blocked = blockedByUnits(actor, allUnits);

  // 1) Grenade at a cluster. A grenade catching 2 or more players
  // strictly beats shooting one, so this comes first. We score
  // potential throw targets by how many players land in the blast.
  if (grenade && actor.ap >= 1) {
    let bestCount = 0;
    let bestCenter: Vec2 | null = null;
    for (const anchor of enemies) {
      if (chebyshev(actor.pos, anchor.pos) > grenade.range) continue;
      if (!hasLineOfSight(map, actor.pos, anchor.pos, smokeTiles)) continue;
      // Anchor is a candidate blast centre; count every other live
      // player who'd also be caught at this anchor.
      const count = enemies.filter((q) =>
        chebyshev(anchor.pos, q.pos) <= grenade.radius).length;
      if (count >= 2 && count > bestCount) {
        bestCount = count;
        bestCenter = anchor.pos;
      }
    }
    if (bestCenter) return { kind: 'throw', center: bestCenter };
  }

  // 2) If any player is in LOS and within our weapon range, prefer to shoot.
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

  // 3) Low-HP and already in cover? Hold position rather than break from it.
  // Melee attackers (berserkers) skip this — their whole identity is
  // closing to range 1, so we don't want them freezing at half-cover
  // when wounded.
  const isMelee = actor.rangeLong <= 1;
  const hasAdjacentShield = ([
    { x: actor.pos.x + 1, y: actor.pos.y },
    { x: actor.pos.x - 1, y: actor.pos.y },
    { x: actor.pos.x, y: actor.pos.y + 1 },
    { x: actor.pos.x, y: actor.pos.y - 1 },
  ] as const).some((p) => {
    const idx = p.y * map.width + p.x;
    const t = map.tiles[idx];
    return t && (t.kind === 'wall' || t.kind === 'cover_full' || t.kind === 'cover_half');
  });
  const woundedThreshold = actor.hpMax * 0.4;
  if (!isMelee && actor.hp <= woundedThreshold && hasAdjacentShield) {
    return { kind: 'wait' };
  }

  // 4) Overwatch: a ranged enemy with full AP, no shot, and a player
  // approaching (within one weapon-range of being shootable) covers a
  // choke instead of advancing blind. Requires cover to be adjacent
  // so the enemy can tuck in; requires ≥2 AP so overwatch is worth it.
  if (!isMelee && actor.ap >= 2 && hasAdjacentShield) {
    const nearestDist = enemies.reduce(
      (m, e) => Math.min(m, chebyshev(actor.pos, e.pos)), Infinity);
    if (nearestDist > actor.rangeLong && nearestDist <= actor.rangeLong + 3) {
      return { kind: 'overwatch' };
    }
  }

  // 5) Otherwise advance toward the nearest player.
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

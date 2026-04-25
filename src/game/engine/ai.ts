import type { GridMap, Unit, Vec2, CoverState, EnemyArchetype } from '../types';
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
 *
 * Optional `archetype` biases specific decision points without
 * rewriting the tree (see `EnemyArchetype` in game/types.ts).
 */
export function decide(
  map: GridMap,
  actor: Unit,
  allUnits: Unit[],
  smokeTiles?: ReadonlySet<number>,
  grenade?: AiGrenade,
  archetype?: EnemyArchetype,
): AiIntent {
  const enemies = allUnits.filter((u) => u.faction === 'player' && u.alive);
  if (enemies.length === 0) return { kind: 'wait' };
  const blocked = blockedByUnits(actor, allUnits);

  // 1) Grenade at a cluster. A grenade catching 2 or more players
  // strictly beats shooting one, so this comes first. We score
  // potential throw targets by how many players land in the blast.
  // 'grenadier' archetype lowers the threshold to 1 — they'll lob a
  // grenade at a single isolated target rather than waiting for a
  // cluster that might never form.
  if (grenade && actor.ap >= 1) {
    const clusterFloor = archetype === 'grenadier' ? 1 : 2;
    let bestCount = 0;
    let bestCenter: Vec2 | null = null;
    for (const anchor of enemies) {
      if (chebyshev(actor.pos, anchor.pos) > grenade.range) continue;
      if (!hasLineOfSight(map, actor.pos, anchor.pos, smokeTiles)) continue;
      // Anchor is a candidate blast centre; count every other live
      // player who'd also be caught at this anchor.
      const count = enemies.filter((q) =>
        chebyshev(anchor.pos, q.pos) <= grenade.radius).length;
      if (count >= clusterFloor && count > bestCount) {
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
  // 'anchor' archetype broadens the threshold to 75% so they hold a
  // strong point even when only lightly tagged.
  // 'sniper' archetype follows the same broadened rule — they want
  // to be the last enemy to leave a long-sightline perch.
  const isMelee = actor.rangeLong <= 1 || archetype === 'berserker';
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
  const holdHpFraction = (archetype === 'anchor' || archetype === 'sniper') ? 0.75 : 0.4;
  const woundedThreshold = actor.hpMax * holdHpFraction;
  if (!isMelee && actor.hp <= woundedThreshold && hasAdjacentShield) {
    return { kind: 'wait' };
  }

  // 4) Overwatch: a ranged enemy with full AP, no shot, and a player
  // approaching (within one weapon-range of being shootable) covers a
  // choke instead of advancing blind. Requires cover to be adjacent
  // so the enemy can tuck in; requires ≥2 AP so overwatch is worth it.
  // 'anchor' + 'sniper' archetypes overwatch more aggressively:
  //   - 'anchor' enters overwatch at any AP (≥1) when adjacent cover
  //     and a player is approaching, even out of range.
  //   - 'sniper' overwatches whenever the nearest player is past
  //     rangeShort but visible — they want to fire only when a
  //     player breaks cover into their line.
  if (!isMelee && hasAdjacentShield) {
    const nearestDist = enemies.reduce(
      (m, e) => Math.min(m, chebyshev(actor.pos, e.pos)), Infinity);
    const apOk = archetype === 'anchor' || archetype === 'sniper'
      ? actor.ap >= 1
      : actor.ap >= 2;
    const sniperWindow = archetype === 'sniper'
      && nearestDist > actor.rangeShort
      && nearestDist <= actor.rangeLong;
    const standardWindow = nearestDist > actor.rangeLong
      && nearestDist <= actor.rangeLong + 3;
    if (apOk && (sniperWindow || standardWindow)) {
      return { kind: 'overwatch' };
    }
  }

  // 'sniper' explicitly resists closing distance: if the nearest
  // player is within rangeLong AND we're at high HP, hold position.
  // Pairs with the broader overwatch trigger above so the sniper
  // never sprints into the open.
  if (archetype === 'sniper' && hasAdjacentShield && actor.hp > actor.hpMax * 0.5) {
    const nearestDist = enemies.reduce(
      (m, e) => Math.min(m, chebyshev(actor.pos, e.pos)), Infinity);
    if (nearestDist <= actor.rangeLong) return { kind: 'wait' };
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
  // 'flanker' archetype adds a bonus when the candidate tile breaks
  // the target's cover (i.e. would have LOS to a player who is
  // currently covered from us). Nudges goblins around walls instead
  // of straight-lining at the squad.
  // 'berserker' archetype skips the cover bias entirely — they sprint.
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
    const coverPenalty = archetype === 'berserker' ? 0
      : (coverAdj ? 0 : 0.5);
    let flankBonus = 0;
    if (archetype === 'flanker') {
      // If we can see the target from this tile AND the target is in
      // any cover from our current position, this is a flank — score
      // it ~1 step better than equivalent non-flank tiles.
      const fromHere = { x, y };
      const seesTarget = hasLineOfSight(map, fromHere, nearest.pos, smokeTiles);
      const coveredFromHere = coverScore(getCoverState(map, actor.pos, nearest.pos)) > 0;
      if (seesTarget && coveredFromHere) flankBonus = -1;
    }
    // 10-tile penalty for tiles without adjacent cover keeps ranged enemies
    // tucked against walls; at equal distance the covered tile wins.
    const score = d + coverPenalty + flankBonus;
    if (score < bestScore) { bestScore = score; bestKey = k; }
  }
  if (bestKey < 0) return { kind: 'wait' };
  const goal = { x: bestKey % 4096, y: Math.floor(bestKey / 4096) };
  const path = findPath(map, actor.pos, goal, blocked);
  if (!path) return { kind: 'wait' };
  return { kind: 'move', path };
}

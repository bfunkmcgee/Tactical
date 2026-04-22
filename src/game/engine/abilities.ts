import type { CombatState, FireEvent } from '../../state/combatStore';
import type { GridMap, Unit, UnitId, Vec2 } from '../types';
import type { RNG } from './rng';
import { chebyshev } from './grid';
import { hasLineOfSight } from './los';

/**
 * Data-driven ability registry. Each soldier ability is a pure `AbilityDef`
 * exported from a content pack. The engine dispatcher (`tryAbility`) handles
 * validation (AP, ammo, class gate, target kind, range, LOS) uniformly, then
 * invokes `activate()` which returns a patch. The store applies the patch +
 * takes care of post-conditions (AP spend, overwatch clear, recalcReach,
 * checkEnd).
 *
 * Ownership boundary:
 *   - Ability logic (what it does)   → content pack
 *   - Dispatch / validation          → this file
 *   - Patch application + side-fx    → combatStore
 *
 * Removing class `if` branches from the store is the primary goal — a new
 * soldier class can add abilities by registering an `AbilityDef`, no engine
 * edits required.
 */

/** What kind of target the ability accepts. */
export type AbilityTargetKind = 'none' | 'enemy' | 'tile';

export type AbilityContext = {
  /** The unit invoking the ability (already validated alive + right faction). */
  actor: Unit;
  /** Resolved target — Unit for `enemy`, Vec2 for `tile`, undefined for `none`. */
  target: Unit | Vec2 | undefined;
  state: CombatState;
  rng: RNG;
};

/**
 * What an ability returns. All fields are optional — only set what actually
 * changed. `units` when set is a full replacement (not a patch). `logs` are
 * plain strings that the dispatcher wraps with log ids. `fireEvents` are
 * emitted without ids; the dispatcher assigns them.
 */
export type AbilityResult = {
  units?: Unit[];
  map?: GridMap;
  logs?: string[];
  fireEvents?: Omit<FireEvent, 'id'>[];
};

export type AbilityDef = {
  /** Unique across packs. Convention: `<class-lowercase>-<verb>` (e.g. `ranger-mark`). */
  id: string;
  /** Display name for logs and HUD tooltips. */
  name: string;
  /** Optional class gate. Actor's SoldierTemplate.class must match this. */
  classId?: string;
  /** AP spent on successful activation. */
  apCost: number;
  /** Optional ammo cost (primary) — used by Warden Bracing Fire. */
  ammoCost?: number;
  targetKind: AbilityTargetKind;
  /** Optional chebyshev range for tile/enemy targets. */
  range?: number;
  /** Optional LOS requirement for enemy targets. */
  requiresLOS?: boolean;
  /** Optional additional predicate on the actor (e.g. requires heavy primary). */
  canUse?: (actor: Unit) => boolean;
  /** Invoked after validation passes. Returns the state patch. Returning
   *  null indicates the ability couldn't resolve (rare — most fail cases
   *  are caught by validation before we get here). */
  activate(ctx: AbilityContext): AbilityResult | null;
};

/**
 * Validate + invoke an ability. Does NOT mutate state or consume AP — the
 * caller (combatStore) applies the returned result and handles AP/ammo
 * spend. Returns null when validation fails, so callers can treat it as
 * "ability not available right now".
 *
 * Class gating is performed by the caller (it needs pack access to read
 * `SoldierTemplate.class`). Everything else is validated here.
 */
export function tryAbility(
  state: CombatState,
  def: AbilityDef,
  actorId: UnitId,
  target: UnitId | Vec2 | undefined,
): AbilityResult | null {
  const actor = state.units.find((u) => u.id === actorId && u.alive);
  if (!actor) return null;
  if (actor.ap < def.apCost) return null;
  if (def.ammoCost !== undefined && (actor.ammo ?? 0) < def.ammoCost) return null;
  if (def.canUse && !def.canUse(actor)) return null;

  let resolved: Unit | Vec2 | undefined;
  if (def.targetKind === 'enemy') {
    if (typeof target !== 'number') return null;
    const t = state.units.find((u) => u.id === target && u.alive && u.faction !== actor.faction);
    if (!t) return null;
    if (def.range !== undefined && chebyshev(actor.pos, t.pos) > def.range) return null;
    if (def.requiresLOS
      && !hasLineOfSight(state.map, actor.pos, t.pos, new Set(state.smokeTiles.keys()))) {
      return null;
    }
    resolved = t;
  } else if (def.targetKind === 'tile') {
    if (!target || typeof target === 'number') return null;
    const pos = target as Vec2;
    if (def.range !== undefined && chebyshev(actor.pos, pos) > def.range) return null;
    resolved = pos;
  }

  return def.activate({ actor, target: resolved, state, rng: state.rng });
}

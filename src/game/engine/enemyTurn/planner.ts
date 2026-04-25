import type { CombatState } from '../../../state/combatStore';
import type { EnemyArchetype, Unit } from '../../types';
import { decide, type AiGrenade } from '../ai';
import type { EnemyStep } from './steps';

/**
 * Pure planner: takes current state + the actor + the actor's grenade
 * profile + optional behavioural archetype, returns the next
 * `EnemyStep` the actor should perform. Wraps the existing `decide()`
 * heuristic so the runner doesn't have to translate AI intents into
 * step shapes inline.
 *
 * Returning `{ kind: 'wait', ... }` means the actor should stop taking
 * actions this turn — either no valid intent (`no-intent`) or no AP left
 * (`out-of-ap`).
 */
export function planNextStep(
  state: CombatState,
  actor: Unit,
  grenade: AiGrenade | undefined,
  archetype?: EnemyArchetype,
): EnemyStep {
  if (actor.ap <= 0) return { kind: 'wait', unitId: actor.id, reason: 'out-of-ap' };

  const smokeSet = new Set(state.smokeTiles.keys());
  const intent = decide(state.map, actor, state.units, smokeSet, grenade, archetype);

  switch (intent.kind) {
    case 'wait':
      return { kind: 'wait', unitId: actor.id, reason: 'no-intent' };
    case 'overwatch':
      return { kind: 'overwatch', unitId: actor.id };
    case 'attack':
      return { kind: 'attack', unitId: actor.id, targetId: intent.target.id };
    case 'throw':
      // Grenade profile must exist (decide only emits 'throw' when it does).
      if (!grenade) return { kind: 'wait', unitId: actor.id, reason: 'no-intent' };
      return { kind: 'throw', unitId: actor.id, center: intent.center, grenade };
    case 'move': {
      // Mirror legacy AP math: take at most `mobility * ap` tiles; charge
      // ceil(steps / mobility) AP once the full path resolves.
      const rawSteps = Math.min(intent.path.length - 1, actor.mobility * actor.ap);
      if (rawSteps <= 0) return { kind: 'wait', unitId: actor.id, reason: 'no-intent' };
      const apCost = Math.max(1, Math.ceil(rawSteps / actor.mobility));
      // Trim the path to the legal step count (keep the starting tile
      // + `rawSteps` more tiles = rawSteps + 1 entries).
      const path = intent.path.slice(0, rawSteps + 1);
      return { kind: 'move', unitId: actor.id, path, apCost };
    }
  }
}

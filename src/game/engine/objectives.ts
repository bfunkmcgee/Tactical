import type { CombatState } from '../../state/combatStore';
import type { MissionObjective } from '../types';

/**
 * Mission-objective evaluator registry. `checkEnd` becomes a two-step
 * lookup: first check player-lost (no alive players — universal rule),
 * then invoke the per-objective-kind evaluator.
 *
 * Adding a new objective kind: add a variant to MissionObjective (in
 * game/types.ts) and register an evaluator here. No engine-core edits.
 */

export type ObjectiveOutcome = 'won' | 'lost' | null;

/** Per-kind evaluator. Receives the objective narrowed to its kind. */
type ObjectiveEvaluator<K extends MissionObjective['kind']> = (
  state: CombatState,
  objective: Extract<MissionObjective, { kind: K }>,
) => ObjectiveOutcome;

/** Registry of evaluators, one per kind. Kept exhaustive by the Record type. */
type EvaluatorMap = {
  [K in MissionObjective['kind']]: ObjectiveEvaluator<K>
};

const EVALUATORS: EvaluatorMap = {
  eliminate_all: (state) => {
    const aliveEnemy = state.units.some((u) => u.faction === 'enemy' && u.alive && !u.role);
    return aliveEnemy ? null : 'won';
  },
  eliminate_target: (state, obj) => {
    const targetAlive = state.units.some((u) =>
      u.faction === 'enemy' && u.alive && u.templateId === obj.templateId);
    return targetAlive ? null : 'won';
  },
  reach_tile: (state, obj) => {
    const reached = state.units.some((u) =>
      u.faction === 'player' && u.alive && u.pos.x === obj.pos.x && u.pos.y === obj.pos.y);
    if (reached) return 'won';
    if (obj.turnLimit !== undefined && state.round > obj.turnLimit) return 'lost';
    return null;
  },
  destroy_objective: (state, obj) => {
    const target = state.units.find((u) =>
      u.role === 'objective' && u.pos.x === obj.pos.x && u.pos.y === obj.pos.y);
    if (!target || !target.alive) return 'won';
    return null;
  },
  defend_point: (state, obj) => {
    return state.defendTurns >= obj.turns ? 'won' : null;
  },
  extract_vip: (state, obj) => {
    const vip = state.units.find((u) => u.role === 'vip');
    if (!vip || !vip.alive) return 'lost';
    if (vip.pos.x === obj.extractTile.x && vip.pos.y === obj.extractTile.y) return 'won';
    return null;
  },
};

/**
 * End-of-action check. Player-loses short-circuit (no alive players)
 * runs first regardless of objective kind; then the per-kind evaluator
 * decides win/continue. Returns null when the mission is still ongoing.
 */
export function evaluateObjective(state: CombatState): ObjectiveOutcome {
  if (!state.units.some((u) => u.faction === 'player' && u.alive)) return 'lost';
  const obj = state.objective;
  // Type system needs a cast here because EvaluatorMap is keyed on kind but
  // TS can't prove the discriminant matches at the indirect lookup site.
  const evalFn = EVALUATORS[obj.kind] as ObjectiveEvaluator<typeof obj.kind>;
  return evalFn(state, obj);
}

import type { CombatState } from '../../state/combatStore';
import type { MissionObjective, Unit } from '../types';
import { pushLog } from './log';

/**
 * End-of-turn transitions. Small, pure helpers pulled out of combatStore so
 * the store's turn actions (endPlayerTurn / runEnemyTurn finale) read as
 * orchestration rather than bookkeeping.
 *
 * Each helper takes the pre-transition state and returns a partial patch
 * the store applies with `set()`.
 */

/**
 * Tick the defend_point counter if a non-role player unit currently holds
 * the defend tile. Returns the new `defendTurns` value (equal to the input
 * if no one is holding or the objective isn't defend_point).
 */
export function advanceDefendCounter(state: CombatState): number {
  if (state.objective.kind !== 'defend_point') return state.defendTurns;
  const obj = state.objective as Extract<MissionObjective, { kind: 'defend_point' }>;
  const holding = state.units.some((u) =>
    u.faction === 'player' && u.alive && !u.role
    && u.pos.x === obj.pos.x && u.pos.y === obj.pos.y);
  return holding ? state.defendTurns + 1 : state.defendTurns;
}

/**
 * Round-end cleanup run after all enemies have acted. Restores every
 * surviving unit's AP, clears 1-round statuses (blinded / suppressed /
 * marked / seeThroughSmoke), ticks smoke clouds down, and emits a
 * round-start log line for the new player phase.
 *
 * The caller applies the returned patch + bumps `round` separately —
 * this helper is a pure function of the pre-transition state.
 */
export function finalizeEnemyTurn(state: CombatState): Partial<CombatState> {
  // Reset AP + clear 1-round buffs/debuffs on everyone who lived through the round.
  const units: Unit[] = state.units.map((u) => u.alive
    ? {
        ...u,
        ap: u.apMax,
        status: {
          ...u.status,
          blinded: false,
          suppressed: false,
          marked: false,
          seeThroughSmoke: false,
        },
      }
    : u);
  // Tick smoke: drop each tile's rounds counter by 1; drop to 0 removes it.
  const nextSmoke = new Map<number, number>();
  let dissipated = 0;
  for (const [k, rounds] of state.smokeTiles) {
    if (rounds > 1) nextSmoke.set(k, rounds - 1);
    else dissipated++;
  }
  const nextRound = state.round + 1;
  const log = pushLog(state.log, dissipated > 0
    ? `Round ${nextRound} — smoke dissipates. Your turn.`
    : `Round ${nextRound} — your turn.`);
  return {
    units,
    phase: 'player',
    round: nextRound,
    smokeTiles: nextSmoke,
    log,
  };
}

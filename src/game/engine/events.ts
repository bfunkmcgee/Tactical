import type { FireStyleClass, MissionObjective, UnitId, Vec2 } from '../types';
import { nextLogId } from './runtimeIds';

/**
 * Authoritative combat event log (Enhancement D foundation).
 *
 * Every resolver that mutates simulation state (shots, abilities,
 * utilities, enemy-turn steps, objective ticks, mission boundaries)
 * appends one or more `CombatEvent`s to `state.combatEventLog`.
 * Combined with the seeded RNG (`src/game/engine/rng.ts`) this is
 * sufficient to replay an entire mission from `mission-start` to
 * `mission-end` — critical for save/load, replay debugging, and
 * future balancing work.
 *
 * Events are additive only: never remove an event, never reorder.
 * If an event needs extending add a new optional field or introduce
 * a new variant. Renderers / replay players must switch-exhaust the
 * union so the TypeScript compiler will flag un-handled new variants.
 *
 * This is distinct from the HUD log (`state.log: LogEntry[]`) which
 * carries pre-formatted human-readable strings for the player. The
 * two are sibling artefacts — the event log is the machine-readable
 * source of truth, the HUD log is an authored presentation of it.
 */

/** Events are discriminated by `t` (short for `type`, matches the plan). */
export type CombatEvent =
  | { t: 'mission-start'; seed: number; missionId: string; objectiveKind: MissionObjective['kind'] }
  | { t: 'turn-start'; side: 'player' | 'enemy'; turnIndex: number }
  | { t: 'move'; unitId: UnitId; from: Vec2; to: Vec2; apSpent: number }
  | { t: 'shot'; shooterId: UnitId; targetId: UnitId; weaponClass: FireStyleClass;
      hit: boolean; damage: number; critical: boolean; hits: number; burstRounds: number }
  | { t: 'ability'; unitId: UnitId; abilityId: string; target?: UnitId | Vec2 }
  | { t: 'utility'; unitId: UnitId; utilityId: string; center: Vec2 }
  | { t: 'overwatch-set'; unitId: UnitId }
  | { t: 'overwatch-fire'; watcherId: UnitId; targetId: UnitId; hit: boolean; damage: number }
  | { t: 'unit-down'; unitId: UnitId; byId?: UnitId }
  | { t: 'objective'; outcome: 'progress' | 'won' | 'lost'; note?: string }
  | { t: 'mission-end'; result: 'won' | 'lost' };

/**
 * Append an event to an existing log, capping length so a long mission
 * doesn't balloon memory. `nextLogId` is reused for correlation with
 * the HUD log entries each event produces — call sites that emit both
 * a `CombatEvent` and a `LogEntry` for the same action get matching ids.
 */
const LOG_MAX_EVENTS = 2000;

export function pushEvent(log: CombatEvent[], event: CombatEvent): CombatEvent[] {
  if (log.length < LOG_MAX_EVENTS) return [...log, event];
  // Drop the oldest event — mission should never get here in practice,
  // but the cap prevents a runaway leak if something loops.
  return [...log.slice(-LOG_MAX_EVENTS + 1), event];
}

/** Bulk append — preserves order, same cap behaviour. */
export function pushEvents(log: CombatEvent[], events: CombatEvent[]): CombatEvent[] {
  if (events.length === 0) return log;
  const merged = [...log, ...events];
  return merged.length <= LOG_MAX_EVENTS
    ? merged
    : merged.slice(-LOG_MAX_EVENTS);
}

// `nextLogId` is re-exported here so resolvers that emit both a
// CombatEvent and a LogEntry can share the id allocation surface.
export { nextLogId };

/**
 * Module-level runtime counters used by combat resolvers to assign unique
 * ids to units, log entries, floaters, and fire events. Extracted from
 * combatStore.ts so engine modules (shotPipeline, overwatch, mission, turn)
 * can bump the counters without needing a store handle.
 *
 * IDs are module-scoped rather than per-store-instance. Tests that need
 * isolation call `resetMissionIds()` at the start of each mission via
 * initMissionState. `nextFireEventId` is deliberately NOT reset — fire
 * events are cross-mission monotonic so renderer subscribers can tell
 * "new event" from "replayed event" via id comparison.
 */

const ids = { unit: 1, log: 1, floater: 1, fire: 1 };

/** Allocate a fresh unit id. */
export const nextUnitId = (): number => ids.unit++;
/** Allocate a fresh log-entry id. */
export const nextLogId = (): number => ids.log++;
/** Allocate a fresh floater id. */
export const nextFloaterId = (): number => ids.floater++;
/** Allocate a fresh fire-event id. Monotonic across missions. */
export const nextFireEventId = (): number => ids.fire++;

/**
 * Reset per-mission id counters. Called from mission init before any
 * `mkSoldierUnit` / `mkEnemyUnit` / log-push so a new mission starts
 * unit/log/floater ids at 1. `nextFireEventId` is intentionally preserved.
 */
export function resetMissionIds(): void {
  ids.unit = 1;
  ids.log = 1;
  ids.floater = 1;
}

import type { Unit } from '../types';

/**
 * Cross-cut engine dependency surface. Shared across the shot pipeline,
 * overwatch, enemy-turn step resolvers, and utility blasts so each module
 * doesn't redeclare the same `armorOf` signature ad-hoc.
 *
 * Pack-aware lookups live in the store (combatStore wires `unitArmor`
 * into every call site). The engine modules themselves stay free of
 * content / registry imports — that boundary is the whole point of
 * Enhancement C.
 *
 * Invariant the store's `unitArmor` implementation guarantees: units
 * without a `loadout` (every enemy today) resolve to 0. Engine code can
 * therefore pass `armorOf` any unit without a faction-gate wrapper; see
 * `combatStore.test.ts` for the pinning test.
 */
export interface EngineDeps {
  /** DR contributed by this unit's equipped armor pieces. 0 when the
   *  unit has no loadout (returned by the store's `unitArmor`). */
  armorOf: (u: Unit) => number;
}

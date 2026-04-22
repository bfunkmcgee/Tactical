import type { Rig, RigPartId } from '../../game/engine/rig';
import { HUMAN_RIG, HUMAN_RIG_SVG } from './human';

/**
 * Rig registry. Rigs are engine-level (they describe body layout, not
 * faction content) but individual packs can extend the catalog if they
 * author non-human rigs in future (e.g. alien, mech).
 *
 * For now only the human rig exists; `rigById('human')` returns it.
 */
const RIGS: Record<string, Rig> = {
  [HUMAN_RIG.id]: HUMAN_RIG,
};

/** Per-rig part-SVG resolver. Keyed by rig id, value maps part-id → url. */
const RIG_SVGS: Record<string, Record<RigPartId, string>> = {
  [HUMAN_RIG.id]: HUMAN_RIG_SVG,
};

/** Lookup. Returns undefined when the rig id isn't registered — callers
 *  should treat that as "fall back to the bespoke-SVG render path". */
export function rigById(id: string): Rig | undefined {
  return RIGS[id];
}

/** Part SVG url for a given (rigId, partId). Returns undefined if either
 *  side is missing. */
export function rigPartSvg(rigId: string, partId: RigPartId): string | undefined {
  return RIG_SVGS[rigId]?.[partId];
}

/** All rigs currently registered. Used by the sprite preloader. */
export function allRigs(): Rig[] {
  return Object.values(RIGS);
}

export { HUMAN_RIG, HUMAN_RIG_SVG };

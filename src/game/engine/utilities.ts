import type { CombatState } from '../../state/combatStore';
import type { GridMap, Unit, UnitId, Utility, UtilityKind, Vec2 } from '../types';
import type { RNG } from './rng';
import { chebyshev, keyOf } from './grid';

/**
 * Data-driven utility resolver registry. One resolver per `UtilityKind`;
 * the store dispatches by kind and applies the returned patch. The grenade
 * blast math lives in a single `resolveBlast` helper so the enemy throw
 * path and player grenade path can share it instead of duplicating.
 *
 * Resolvers are pure: they produce new arrays/maps rather than mutating.
 * Store-side concerns (AP spend, charge decrement, overwatch clear,
 * recalcReach, checkEnd, log wrapping) remain in combatStore — a resolver
 * returns the damage/heal/map/smoke patch plus a human-readable message.
 */

/** Rounds a smoke tile persists — shared with combatStore. */
export const SMOKE_DURATION = 2;

/** Floater emitted by a resolver; store turns these into real Floater entries. */
export type UtilityFloater = { pos: Vec2; text: string; color: number };

export type UtilityContext = {
  actor: Unit;
  center: Vec2;
  utility: Utility;
  state: CombatState;
  rng: RNG;
  /** Damage reduction resolver — armor of the unit taking the hit. Supplied
   *  by the store since unit armor depends on pack lookups. */
  armorOf: (u: Unit) => number;
};

export type UtilityResult = {
  units: Unit[];
  map?: GridMap;
  smokeTiles?: Map<number, number>;
  floaters: UtilityFloater[];
  /** Human-readable line for the combat log. */
  message: string;
  /** Log kind hint — 'heal' for medkit, 'info' otherwise. */
  logKind?: 'info' | 'heal';
  /** Enemy kills produced by this utility (for score/meta tracking). */
  kills: number;
  /** Suggested screen-shake frames (0 = none). Grenades set this. */
  shakeFrames: number;
};

type UtilityResolver = (ctx: UtilityContext) => UtilityResult;

const RESOLVERS: Record<UtilityKind, UtilityResolver> = {
  grenade: resolveGrenade,
  flashbang: resolveFlashbang,
  smoke: resolveSmoke,
  medkit: resolveMedkit,
};

/** Look up the resolver for a utility and invoke it. Throws on unknown kind
 *  so missing registry wiring surfaces loudly instead of silently no-opping. */
export function resolveUtility(ctx: UtilityContext): UtilityResult {
  const resolver = RESOLVERS[ctx.utility.kind];
  if (!resolver) {
    throw new Error(`[utilities] no resolver for utility kind: ${ctx.utility.kind}`);
  }
  return resolver(ctx);
}

/**
 * Shared blast helper — the bit the player grenade and enemy throw both
 * want. Rolls damage per victim inside the radius, returns the patched
 * unit array + kills + map-after-cover-shredding + per-victim damage for
 * floater generation.
 */
export function resolveBlast(
  state: CombatState,
  center: Vec2,
  blast: { dmgMin: number; dmgMax: number; radius: number },
  armorOf: (u: Unit) => number,
  rng: RNG,
): {
  units: Unit[];
  map: GridMap;
  tilesChanged: number;
  /** Victims and the damage each took (0 if they dodged or were already down). */
  damageByUnit: Map<UnitId, number>;
  kills: number;
} {
  const victims: Unit[] = [];
  for (const other of state.units) {
    if (!other.alive) continue;
    if (chebyshev(other.pos, center) <= blast.radius) victims.push(other);
  }
  const damageByUnit = new Map<UnitId, number>();
  let kills = 0;
  const units = state.units.map((o) => {
    if (!victims.some((v) => v.id === o.id)) return o;
    const dr = armorOf(o);
    const dmg = Math.max(1, (blast.dmgMin + rng.int(blast.dmgMax - blast.dmgMin + 1)) - dr);
    const newHp = Math.max(0, o.hp - dmg);
    const died = newHp <= 0;
    if (died && o.faction === 'enemy') kills += 1;
    damageByUnit.set(o.id, dmg);
    return { ...o, hp: newHp, alive: !died };
  });
  const demolished = damageCoverInRadius(state.map, center, blast.radius);
  return {
    units,
    map: demolished.map,
    tilesChanged: demolished.tilesChanged,
    damageByUnit,
    kills,
  };
}

/**
 * Degrade cover tiles (full → half → floor) within a chebyshev radius.
 * Returns the same map reference when nothing changed so renderers can
 * early-out via identity checks.
 */
export function damageCoverInRadius(
  map: GridMap, center: Vec2, radius: number,
): { map: GridMap; tilesChanged: number } {
  let changed = 0;
  let nextTiles: GridMap['tiles'] | null = null;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) > radius) continue;
      const x = center.x + dx, y = center.y + dy;
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
      const idx = y * map.width + x;
      const t = map.tiles[idx];
      if (!t) continue;
      if (t.kind !== 'cover_full' && t.kind !== 'cover_half') continue;
      if (!nextTiles) nextTiles = map.tiles.slice();
      nextTiles[idx] = { ...t, kind: t.kind === 'cover_full' ? 'cover_half' : 'floor' };
      changed++;
    }
  }
  if (!nextTiles) return { map, tilesChanged: 0 };
  return { map: { ...map, tiles: nextTiles }, tilesChanged: changed };
}

// ---- Per-kind resolvers -----------------------------------------------

function resolveGrenade(ctx: UtilityContext): UtilityResult {
  const { actor, center, utility, state, rng, armorOf } = ctx;
  const dmgMin = utility.dmgMin ?? 0;
  const dmgMax = utility.dmgMax ?? 0;
  const blast = resolveBlast(state, center, { dmgMin, dmgMax, radius: utility.radius }, armorOf, rng);
  const floaters: UtilityFloater[] = [];
  for (const [unitId, dmg] of blast.damageByUnit) {
    const v = state.units.find((u) => u.id === unitId);
    if (v) floaters.push({ pos: v.pos, text: `-${dmg}`, color: 0xff9a3c });
  }
  const victimCount = blast.damageByUnit.size;
  const shredded = blast.tilesChanged;
  const message = shredded > 0
    ? `${actor.name} throws ${utility.name} — ${victimCount} caught, ${shredded} cover tile${shredded === 1 ? '' : 's'} shredded.`
    : `${actor.name} throws ${utility.name} — ${victimCount} caught in the blast.`;
  return {
    units: blast.units,
    map: blast.map === state.map ? undefined : blast.map,
    floaters,
    message,
    kills: blast.kills,
    shakeFrames: 10,
  };
}

function resolveFlashbang(ctx: UtilityContext): UtilityResult {
  const { actor, center, utility, state } = ctx;
  const units = state.units.map((o) => {
    if (!o.alive) return o;
    if (chebyshev(o.pos, center) > utility.radius) return o;
    if (o.faction === actor.faction) return o;
    return { ...o, status: { ...o.status, blinded: true } };
  });
  return {
    units,
    floaters: [],
    message: `${actor.name} pops ${utility.name}; foes are blinded.`,
    kills: 0,
    shakeFrames: 0,
  };
}

function resolveSmoke(ctx: UtilityContext): UtilityResult {
  const { actor, center, utility, state } = ctx;
  const smokeTiles = new Map(state.smokeTiles);
  let added = 0;
  for (let dy = -utility.radius; dy <= utility.radius; dy++) {
    for (let dx = -utility.radius; dx <= utility.radius; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) > utility.radius) continue;
      const x = center.x + dx, y = center.y + dy;
      if (x < 0 || y < 0 || x >= state.map.width || y >= state.map.height) continue;
      const tile = state.map.tiles[y * state.map.width + x];
      if (!tile || tile.kind === 'wall') continue;
      smokeTiles.set(keyOf(x, y), SMOKE_DURATION);
      added++;
    }
  }
  return {
    units: state.units,
    smokeTiles,
    floaters: [],
    message: `${actor.name} deploys ${utility.name}; ${added} tiles of smoke roll out.`,
    kills: 0,
    shakeFrames: 0,
  };
}

function resolveMedkit(ctx: UtilityContext): UtilityResult {
  const { actor, center, utility, state } = ctx;
  const heal = utility.heal ?? 0;
  const floaters: UtilityFloater[] = [];
  const units = state.units.map((o) => {
    if (!o.alive) return o;
    if (chebyshev(o.pos, center) > 1) return o;
    if (o.faction !== 'player') return o;
    const healed = Math.min(o.hpMax, o.hp + heal);
    const delta = healed - o.hp;
    if (delta > 0) floaters.push({ pos: o.pos, text: `+${delta}`, color: 0x57d18b });
    return { ...o, hp: healed };
  });
  return {
    units,
    floaters,
    message: `${actor.name} applies ${utility.name}.`,
    logKind: 'heal',
    kills: 0,
    shakeFrames: 0,
  };
}

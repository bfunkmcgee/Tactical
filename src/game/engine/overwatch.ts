import type { CombatState, FireEvent, Floater } from '../../state/combatStore';
import type { LogEntry, ShotPreview, Unit, UnitId, Weapon, WeaponMod } from '../types';
import { previewShot, resolveShot, resolveEnemyAttack } from './combat';
import { hasLineOfSight } from './los';
import { nextFireEventId, nextLogId } from './runtimeIds';
import type { CombatEvent } from './events';
import { pushEvents } from './events';

/**
 * Overwatch reaction fire — shared by both factions. The two paths
 * (player-watches-enemy and enemy-watches-player) share a common
 * structure: find the first valid watcher, roll a shot with an accuracy
 * penalty, apply the result, emit a fire event + log line.
 *
 * The resolver differs because player shots use previewShot/resolveShot
 * (pack-aware weapon + mods) while enemy shots use resolveEnemyAttack
 * (template-driven innate stats). Both branches converge on the same
 * ShotOutcome shape so the patch-building code is shared below.
 */

const HIT_PENALTY = 15;
const CRIT_PENALTY = 10;

/** Common deps — small surface, pack lookups live in the store. */
export type OverwatchDeps = {
  armorOf: (u: Unit) => number;
  modsOf: (u: Unit, useSidearm: boolean) => WeaponMod[];
  primaryOf: (u: Unit) => Weapon | null;
  fireClassFor: (u: Unit, weapon: Weapon | null) => FireEvent['fireClass'];
  floaterFor: (pos: { x: number; y: number }, text: string, color: number) => Floater;
  /** Enemy-template lookup for burstShots etc. on the enemy overwatch path. */
  burstShotsForTemplate: (templateId: string) => number | undefined;
};

export type OverwatchPatch = {
  units: Unit[];
  kills: number;
  damageTaken: number;
  log: LogEntry[];
  floaters: Floater[];
  fireEvents: FireEvent[];
  combatEventLog: CombatEvent[];
  shakeFrames: number;
  /** True if a watcher reacted. False means no overwatch was pending or no
   *  LOS/ammo; caller can no-op. */
  triggered: boolean;
};

/**
 * Player overwatch reacts to an enemy entering LOS. Applies the HIT/CRIT
 * penalty to the preview before rolling, consumes the watcher's overwatch
 * flag + 1 primary ammo regardless of outcome.
 */
export function triggerPlayerOverwatch(
  state: CombatState,
  enemyId: UnitId,
  deps: OverwatchDeps,
): OverwatchPatch {
  const empty = noop(state);
  const enemy = state.units.find((u) => u.id === enemyId);
  if (!enemy || !enemy.alive) return empty;
  const smokeSet = new Set(state.smokeTiles.keys());
  // First overwatching player with LOS + ammo. Thermal mod bypasses smoke.
  const watcher = state.units.find((u) => {
    if (u.faction !== 'player' || !u.alive || !u.status.overwatch || u.ammo <= 0) return false;
    const mods = deps.modsOf(u, false);
    const blockers = mods.some((m) => m.effects.flags?.includes('thermal'))
      ? undefined : smokeSet;
    return hasLineOfSight(state.map, u.pos, enemy.pos, blockers);
  });
  if (!watcher) return empty;
  const weapon = deps.primaryOf(watcher);
  if (!weapon) return empty;
  const watcherMods = deps.modsOf(watcher, false);
  const watcherSmoke = watcherMods.some((m) => m.effects.flags?.includes('thermal'))
    ? undefined : smokeSet;
  const base = previewShot(state.map, watcher, enemy, weapon, 0, watcherSmoke, watcherMods);
  const preview: ShotPreview = { ...base,
    hitChance: Math.max(1, base.hitChance - HIT_PENALTY),
    critChance: Math.max(0, base.critChance - CRIT_PENALTY) };
  const result = resolveShot(preview, weapon, null, state.rng, watcherMods);

  let units = state.units.map((o) => o.id === watcher.id
    ? { ...o, ammo: o.ammo - 1, status: { ...o.status, overwatch: false } } : o);
  const floaters = [...state.floaters];
  let entry: LogEntry;
  let kills = state.kills;
  if (result.kind === 'miss') {
    const burstMiss = result.burstRounds ? ` — 0/${result.burstRounds} rounds hit` : '';
    entry = { id: nextLogId(),
      text: `${watcher.name} reacts — misses ${enemy.name}${burstMiss}.`, kind: 'miss' };
    floaters.push(deps.floaterFor(enemy.pos, 'MISS', 0xf5c55a));
  } else {
    const newHp = Math.max(0, enemy.hp - result.damage);
    const died = newHp <= 0;
    units = units.map((o) => o.id === enemy.id ? { ...o, hp: newHp, alive: !died } : o);
    if (died) kills += 1;
    const burstTag = result.hits && result.burstRounds
      ? ` — ${result.hits}/${result.burstRounds} rounds hit` : '';
    entry = { id: nextLogId(),
      text: `${watcher.name} reacts — ${result.critical ? 'crits ' : 'hits '}${enemy.name} for ${result.damage}${burstTag}${died ? ' — eliminated!' : ''}.`,
      kind: died ? 'kill' : result.critical ? 'crit' : 'hit' };
    floaters.push(deps.floaterFor(enemy.pos, `-${result.damage}`, 0xf5c55a));
  }
  const fireEvents = [...state.fireEvents, {
    id: nextFireEventId(), shooterId: watcher.id, shooterPos: watcher.pos,
    targetPos: enemy.pos, fireClass: deps.fireClassFor(watcher, weapon),
  }];
  const hit = result.kind === 'hit';
  const events: CombatEvent[] = [{
    t: 'overwatch-fire', watcherId: watcher.id, targetId: enemy.id,
    hit, damage: hit ? result.damage : 0,
  }];
  if (hit && Math.max(0, enemy.hp - result.damage) <= 0) {
    events.push({ t: 'unit-down', unitId: enemy.id, byId: watcher.id });
  }
  return {
    units, kills, damageTaken: state.damageTaken,
    log: [...state.log, entry].slice(-60),
    floaters, fireEvents,
    combatEventLog: pushEvents(state.combatEventLog, events),
    shakeFrames: hit ? 8 : 0,
    triggered: true,
  };
}

/**
 * Enemy overwatch reacts when a player moves into LOS. Same structural
 * steps as the player path: find watcher, roll penalized shot, apply.
 * Uses resolveEnemyAttack (template-driven) instead of previewShot.
 */
export function triggerEnemyOverwatch(
  state: CombatState,
  playerId: UnitId,
  deps: OverwatchDeps,
): OverwatchPatch {
  const empty = noop(state);
  const player = state.units.find((u) => u.id === playerId);
  if (!player || !player.alive) return empty;
  const smokeSet = new Set(state.smokeTiles.keys());
  const watcher = state.units.find((u) => {
    if (u.faction !== 'enemy' || !u.alive || !u.status.overwatch) return false;
    return hasLineOfSight(state.map, u.pos, player.pos, smokeSet);
  });
  if (!watcher) return empty;
  const armorDr = deps.armorOf(player);
  const burst = deps.burstShotsForTemplate(watcher.templateId);
  const base = resolveEnemyAttack(state.map, watcher, player, armorDr, state.rng, smokeSet, burst);
  // Retroactive overwatch penalty: dismiss "just-barely" rolls to miss so
  // we don't have to duplicate the burst/crit math from resolveEnemyAttack.
  const result = base.preview.hitChance < HIT_PENALTY + 15
    ? { ...base, kind: 'miss' as const }
    : base;

  let units = state.units.map((o) => o.id === watcher.id
    ? { ...o, ap: 0, status: { ...o.status, overwatch: false } } : o);
  let damageTaken = state.damageTaken;
  const floaters = [...state.floaters];
  let entry: LogEntry;
  if (result.kind === 'miss') {
    entry = { id: nextLogId(), text: `${watcher.name} reacts — misses ${player.name}.`, kind: 'miss' };
    floaters.push(deps.floaterFor(player.pos, 'MISS', 0xff9a3c));
  } else {
    const newHp = Math.max(0, player.hp - result.damage);
    const died = newHp <= 0;
    units = units.map((o) => o.id === player.id ? { ...o, hp: newHp, alive: !died } : o);
    damageTaken += result.damage;
    entry = { id: nextLogId(),
      text: `${watcher.name} reacts — hits ${player.name} for ${result.damage}${died ? ' — down!' : ''}.`,
      kind: died ? 'kill' : 'hit' };
    floaters.push(deps.floaterFor(player.pos, `-${result.damage}`, 0xff5a6a));
  }
  const fireEvents = [...state.fireEvents, {
    id: nextFireEventId(), shooterId: watcher.id, shooterPos: watcher.pos,
    targetPos: player.pos, fireClass: deps.fireClassFor(watcher, null),
  }];
  const hit = result.kind === 'hit';
  const events: CombatEvent[] = [{
    t: 'overwatch-fire', watcherId: watcher.id, targetId: player.id,
    hit, damage: hit ? result.damage : 0,
  }];
  if (hit && Math.max(0, player.hp - result.damage) <= 0) {
    events.push({ t: 'unit-down', unitId: player.id, byId: watcher.id });
  }
  return {
    units, kills: state.kills, damageTaken,
    log: [...state.log, entry].slice(-60),
    floaters, fireEvents,
    combatEventLog: pushEvents(state.combatEventLog, events),
    shakeFrames: hit ? 8 : 0,
    triggered: true,
  };
}

/** No-op patch — same fields as state, triggered: false. */
function noop(state: CombatState): OverwatchPatch {
  return {
    units: state.units, kills: state.kills, damageTaken: state.damageTaken,
    log: state.log, floaters: state.floaters, fireEvents: state.fireEvents,
    combatEventLog: state.combatEventLog,
    shakeFrames: 0, triggered: false,
  };
}

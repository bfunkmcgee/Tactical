import type { CombatState, FireEvent, Floater } from '../../../state/combatStore';
import type { LogEntry, Unit, UnitId, Vec2, WeaponClass } from '../../types';
import type { AiGrenade } from '../ai';
import type { EngineDeps } from '../deps';
import { resolveEnemyAttack } from '../combat';
import { resolveBlast } from '../utilities';
import { triggerPlayerOverwatch, type OverwatchDeps } from '../overwatch';
import { pushLog } from '../log';
import { nextFireEventId, nextLogId } from '../runtimeIds';
import type { CombatEvent } from '../events';
import { pushEvents } from '../events';

/**
 * Step-object enemy turn execution. `runEnemyTurn` drives an async loop;
 * each iteration picks a step (from the planner) and feeds it through
 * `resolveStep`, which returns a patch + an optional `next` step for
 * continuation (used for tile-by-tile movement and mid-path overwatch
 * interrupts).
 *
 * This factoring makes every enemy action independently unit-testable
 * with a hand-built state fixture + a seeded RNG — the step resolver is
 * pure, and the async timing lives only in the runner.
 */

/** Discriminated union of enemy actions. The `unitId` names the acting
 *  enemy. `move` carries the full remaining path so each resolveStep call
 *  advances one tile and returns the shortened path as `next`. */
export type EnemyStep =
  | { kind: 'move'; unitId: UnitId; path: Vec2[]; apCost: number }
  | { kind: 'attack'; unitId: UnitId; targetId: UnitId }
  | { kind: 'throw'; unitId: UnitId; center: Vec2; grenade: AiGrenade }
  | { kind: 'overwatch'; unitId: UnitId }
  | { kind: 'wait'; unitId: UnitId; reason: 'no-intent' | 'out-of-ap' };

/** StepResult — a patch for the store to apply + an optional follow-on
 *  step. `applied=false` means the step was a no-op (missing actor, etc.)
 *  and the runner should skip delay + patch application. */
export type StepResult = {
  patch: Partial<CombatState>;
  next?: EnemyStep;
  applied: boolean;
  /** Recommended delay the runner should wait before processing `next` or
   *  moving on. 0 for no-op / tail steps; ~110 for mid-path move; ~220
   *  for attack/throw. */
  delayMs: number;
};

/** Deps the step resolvers need. Pack-aware helpers come from the store. */
export type StepDeps = EngineDeps & {
  overwatch: OverwatchDeps;
  floaterFor: (pos: Vec2, text: string, color: number) => Floater;
  fireClassFor: (u: Unit, weapon: null) => WeaponClass;
  burstShotsForTemplate: (tid: string) => number | undefined;
};

const DELAY_MOVE_TILE = 110;
const DELAY_ACTION = 220;

/** Single dispatch point. Runner calls this once per step. */
export function resolveStep(state: CombatState, step: EnemyStep, deps: StepDeps): StepResult {
  switch (step.kind) {
    case 'move': return resolveMove(state, step, deps);
    case 'attack': return resolveAttack(state, step, deps);
    case 'throw': return resolveThrow(state, step, deps);
    case 'overwatch': return resolveOverwatchSet(state, step);
    case 'wait': return { patch: {}, applied: false, delayMs: 0 };
  }
}

/**
 * Advance the actor one tile along `step.path`. If a player overwatches
 * the new tile, apply the reaction inline and truncate the remaining
 * path (matches legacy behaviour — interrupted moves don't refund AP).
 * Returns `next` for the remainder until the path is exhausted; the
 * final call applies the AP cost and emits the "advances" log line.
 */
function resolveMove(state: CombatState, step: EnemyStep & { kind: 'move' }, deps: StepDeps): StepResult {
  const actor = state.units.find((u) => u.id === step.unitId && u.alive);
  if (!actor) return { patch: {}, applied: false, delayMs: 0 };

  // Path is [current, next1, next2, ..., destination]. When length hits 1
  // we've reached the end — spend AP + log the advance.
  if (step.path.length < 2) {
    const units = state.units.map((u) => u.id === actor.id ? { ...u, ap: u.ap - step.apCost } : u);
    const log = pushLog(state.log, `${actor.name} advances.`);
    // One 'move' event covers the whole path: start = the actor's spawn
    // this plan, to = the actor's current position (which is already the
    // destination by the time we hit this branch).
    const moveEvent: CombatEvent = {
      t: 'move', unitId: actor.id,
      from: actor.pos, to: actor.pos, apSpent: step.apCost,
    };
    return {
      patch: { units, log, combatEventLog: pushEvents(state.combatEventLog, [moveEvent]) },
      applied: true, delayMs: 0,
    };
  }

  const nextTile = step.path[1];
  const unitsAfterMove = state.units.map((u) => u.id === actor.id ? { ...u, pos: nextTile } : u);
  const stateAfterMove = { ...state, units: unitsAfterMove };

  // Player overwatch reacts to the enemy entering LOS on the new tile.
  const ow = triggerPlayerOverwatch(stateAfterMove, actor.id, deps.overwatch);
  if (ow.triggered) {
    // Overwatch patch overrides the post-move state (it carries the
    // damaged enemy + reduced-ammo watcher + new log/floater/fireEvents
    // + combatEventLog with the overwatch-fire event appended).
    const combined: Partial<CombatState> = {
      units: ow.units, kills: ow.kills, damageTaken: ow.damageTaken,
      log: ow.log, floaters: ow.floaters, fireEvents: ow.fireEvents,
      combatEventLog: ow.combatEventLog,
      shakeFrames: ow.shakeFrames,
    };
    const actorAfter = ow.units.find((u) => u.id === actor.id);
    if (!actorAfter || !actorAfter.alive) {
      // Actor died to overwatch — stop here, don't pay AP or log advance.
      return { patch: combined, applied: true, delayMs: DELAY_ACTION };
    }
    // Actor survived; continue with the shortened path.
    return {
      patch: combined,
      next: { kind: 'move', unitId: step.unitId, path: step.path.slice(1), apCost: step.apCost },
      applied: true,
      delayMs: DELAY_ACTION,
    };
  }

  // No overwatch — just the move.
  return {
    patch: { units: unitsAfterMove },
    next: { kind: 'move', unitId: step.unitId, path: step.path.slice(1), apCost: step.apCost },
    applied: true,
    delayMs: DELAY_MOVE_TILE,
  };
}

/**
 * Resolve one enemy attack step — runs resolveEnemyAttack, builds the
 * log entry, updates HP + suppressed + damageTaken + fireEvents + floaters.
 * Matches the legacy inline attack branch in runEnemyTurn.
 */
function resolveAttack(state: CombatState, step: EnemyStep & { kind: 'attack' }, deps: StepDeps): StepResult {
  const actor = state.units.find((u) => u.id === step.unitId && u.alive);
  const target = state.units.find((u) => u.id === step.targetId && u.alive);
  if (!actor || !target) return { patch: {}, applied: false, delayMs: 0 };
  // deps.armorOf returns 0 for any unit without a loadout — see
  // EngineDeps contract in src/game/engine/deps.ts. No faction gate
  // needed (though in practice the enemy-turn target is always a
  // player unit).
  const armorDr = deps.armorOf(target);
  const burst = deps.burstShotsForTemplate(actor.templateId);
  const smokeSet = new Set(state.smokeTiles.keys());
  const result = resolveEnemyAttack(state.map, actor, target, armorDr, state.rng, smokeSet, burst);

  let units = state.units.map((o) => o.id === actor.id ? { ...o, ap: o.ap - 1 } : o);
  let damageTaken = state.damageTaken;
  let entry: LogEntry;
  const floaters = [...state.floaters];
  const fireClass = deps.fireClassFor(actor, null);
  const fireEvents = [...state.fireEvents, {
    id: nextFireEventId(),
    shooterId: actor.id,
    shooterPos: actor.pos,
    targetPos: target.pos,
    fireClass,
  } satisfies FireEvent];
  if (result.kind === 'miss') {
    const burstMiss = result.burstRounds ? ` — 0/${result.burstRounds} rounds hit` : '';
    entry = {
      id: nextLogId(),
      text: `${actor.name} misses ${target.name} (${result.preview.hitChance}%)${burstMiss}.`,
      kind: 'miss',
    };
    floaters.push(deps.floaterFor(target.pos, 'MISS', 0x6b7689));
  } else {
    const newHp = Math.max(0, target.hp - result.damage);
    const died = newHp <= 0;
    // Heavy enemy weapons (scrap MG) suppress on hit, matching player heavies.
    const suppresses = !died && fireClass === 'heavy';
    units = units.map((o) => o.id === target.id
      ? { ...o, hp: newHp, alive: !died,
          status: suppresses ? { ...o.status, suppressed: true } : o.status }
      : o);
    if (target.faction === 'player') damageTaken += result.damage;
    const burstTag = result.hits && result.burstRounds
      ? ` — ${result.hits}/${result.burstRounds} rounds hit` : '';
    entry = {
      id: nextLogId(),
      text: `${actor.name} ${result.critical ? 'critically ' : ''}hits ${target.name} for ${result.damage}${burstTag}${died ? ' — down!' : ''}.`,
      kind: died ? 'kill' : result.critical ? 'crit' : 'hit',
    };
    floaters.push(deps.floaterFor(target.pos, `-${result.damage}`, result.critical ? 0xff9a3c : 0xff5a6a));
  }

  // Authoritative shot event — mirrors shotPipeline's emission so the
  // event log reads identically for player-fired and enemy-fired shots.
  const hit = result.kind === 'hit';
  const shotEvent: CombatEvent = {
    t: 'shot', shooterId: actor.id, targetId: target.id,
    weaponClass: fireClass,
    hit,
    damage: hit ? result.damage : 0,
    critical: hit ? !!result.critical : false,
    hits: hit ? (result.hits ?? 1) : 0,
    burstRounds: result.burstRounds ?? 0,
  };
  const events: CombatEvent[] = [shotEvent];
  if (hit && Math.max(0, target.hp - result.damage) <= 0) {
    events.push({ t: 'unit-down', unitId: target.id, byId: actor.id });
  }

  return {
    patch: {
      units,
      damageTaken,
      log: [...state.log, entry].slice(-60),
      floaters,
      fireEvents,
      combatEventLog: pushEvents(state.combatEventLog, events),
      shakeFrames: result.kind === 'hit' ? 8 : 0,
    },
    applied: true,
    delayMs: DELAY_ACTION,
  };
}

/**
 * Resolve an enemy grenade throw via the shared resolveBlast helper.
 * Emits the heavy-class fire event the renderer uses for the throw arc.
 */
function resolveThrow(state: CombatState, step: EnemyStep & { kind: 'throw' }, deps: StepDeps): StepResult {
  const actor = state.units.find((u) => u.id === step.unitId && u.alive);
  if (!actor) return { patch: {}, applied: false, delayMs: 0 };

  // `deps.armorOf` already returns 0 for units without a loadout — see
  // EngineDeps in src/game/engine/deps.ts. No faction gate needed.
  const blast = resolveBlast(
    state, step.center,
    { dmgMin: step.grenade.dmgMin, dmgMax: step.grenade.dmgMax, radius: step.grenade.radius },
    deps.armorOf,
    state.rng,
  );
  const units = blast.units.map((o) => o.id === actor.id ? { ...o, ap: o.ap - 1 } : o);

  const floaters = [...state.floaters];
  for (const [unitId, dmg] of blast.damageByUnit) {
    const v = state.units.find((o) => o.id === unitId);
    if (v && dmg > 0) floaters.push(deps.floaterFor(v.pos, `-${dmg}`, 0xff9a3c));
  }
  const damageTaken = state.damageTaken + units
    .filter((u) => u.faction === 'player' && !u.alive && state.units.find((o) => o.id === u.id)?.alive)
    .reduce((s, u) => s + (state.units.find((o) => o.id === u.id)?.hp ?? 0), 0);

  const fireEvents = [...state.fireEvents, {
    id: nextFireEventId(),
    shooterId: actor.id,
    shooterPos: actor.pos,
    targetPos: step.center,
    fireClass: 'heavy' as WeaponClass,
  } satisfies FireEvent];
  const victimCount = blast.damageByUnit.size;
  const shredded = blast.tilesChanged;
  const log = pushLog(state.log,
    `${actor.name} lobs a crude grenade — ${victimCount} caught${shredded > 0 ? `, ${shredded} cover tile${shredded === 1 ? '' : 's'} shredded` : ''}.`);
  // Throw as a utility event — enemies don't have a unique utility id, so
  // we use a synthetic 'enemy-grenade' id that replay players can key off.
  const events: CombatEvent[] = [{
    t: 'utility', unitId: actor.id, utilityId: 'enemy-grenade', center: step.center,
  }];
  // unit-down follow-ups for any victims whose HP dropped to 0.
  for (const [unitId, dmg] of blast.damageByUnit) {
    const pre = state.units.find((o) => o.id === unitId);
    const post = units.find((o) => o.id === unitId);
    if (pre && post && pre.alive && !post.alive) {
      events.push({ t: 'unit-down', unitId: pre.id, byId: actor.id });
    }
    void dmg;
  }
  return {
    patch: {
      units, damageTaken, floaters, fireEvents, map: blast.map, log,
      combatEventLog: pushEvents(state.combatEventLog, events),
      shakeFrames: 10,
    },
    applied: true,
    delayMs: DELAY_ACTION,
  };
}

/** Set the actor's overwatch flag + zero their AP. One-shot step. */
function resolveOverwatchSet(state: CombatState, step: EnemyStep & { kind: 'overwatch' }): StepResult {
  const actor = state.units.find((u) => u.id === step.unitId && u.alive);
  if (!actor) return { patch: {}, applied: false, delayMs: 0 };
  const units = state.units.map((o) => o.id === actor.id
    ? { ...o, ap: 0, status: { ...o.status, overwatch: true } } : o);
  const log = pushLog(state.log, `${actor.name} sets overwatch.`);
  return {
    patch: {
      units, log,
      combatEventLog: pushEvents(state.combatEventLog, [{ t: 'overwatch-set', unitId: actor.id }]),
    },
    applied: true, delayMs: 0,
  };
}


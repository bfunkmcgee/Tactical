import type { CombatState, FireEvent, Floater } from '../../state/combatStore';
import type { LogEntry, Unit, UnitId, Weapon } from '../types';
import type { WeaponMod } from '../types';
import { previewShot, resolveShot } from './combat';
import { hasLineOfSight } from './los';
import { nextFireEventId, nextFloaterId, nextLogId } from './runtimeIds';
import type { CombatEvent } from './events';
import { pushEvents } from './events';

/**
 * Shared shot-resolution path used by primary fire, sidearm fire, and the
 * overwatch reaction. Pure in intent: reads `state` + the pack-aware helpers
 * passed in via `deps`, returns a patch; the caller (combatStore) applies
 * the patch with `set()`.
 *
 * AP / ammo / overwatch-flag consumption on the shooter is handled here so
 * the three call sites don't duplicate the math; sidearm callers pass
 * `useSidearm: true` to read/write `sidearmAmmo` instead of `ammo` and to
 * skip the `endsTurn` flag on heavy primaries.
 */

export type ShotPipelineDeps = {
  armorOf: (u: Unit) => number;
  modsOf: (u: Unit, useSidearm: boolean) => WeaponMod[];
  fireClassFor: (u: Unit, weapon: Weapon | null) => FireEvent['fireClass'];
  /** Optional floater factory hook. Supplied by the store so floaters get
   *  store-canonical TTL values. If omitted, pipeline emits plain {pos,text,color}
   *  and the caller wraps. */
  floaterFor: (pos: { x: number; y: number }, text: string, color: number) => Floater;
};

/** Patch returned by applyShotResult. Apply with a single `set({...patch})`. */
export type ShotPatch = {
  units: Unit[];
  kills: number;
  log: LogEntry[];
  floaters: Floater[];
  fireEvents: FireEvent[];
  combatEventLog: CombatEvent[];
  shakeFrames: number;
  /** When true the shot path ran (shooter had AP+ammo, target in LOS). False
   *  means validation rejected the shot; no state change. */
  applied: boolean;
};

export function applyShotResult(
  state: CombatState,
  shooterId: UnitId,
  targetId: UnitId,
  weapon: Weapon,
  useSidearm: boolean,
  deps: ShotPipelineDeps,
): ShotPatch {
  const u = state.units.find((x) => x.id === shooterId);
  const t = state.units.find((x) => x.id === targetId);
  const empty: ShotPatch = {
    units: state.units, kills: state.kills, log: state.log,
    floaters: state.floaters, fireEvents: state.fireEvents,
    combatEventLog: state.combatEventLog,
    shakeFrames: 0, applied: false,
  };
  if (!u || !t || !u.alive || !t.alive) return empty;
  const ammoField = useSidearm ? 'sidearmAmmo' : 'ammo';
  if (u.ap < weapon.apCost || u[ammoField] <= 0) return empty;

  const mods = deps.modsOf(u, useSidearm);
  const thermalSkipsSmoke = mods.some((m) => m.effects.flags?.includes('thermal'));
  const smokeSet = new Set(state.smokeTiles.keys());
  const losBlockers = thermalSkipsSmoke ? undefined : smokeSet;
  if (!hasLineOfSight(state.map, u.pos, t.pos, losBlockers)) return empty;

  const preview = previewShot(
    state.map, u, t, weapon, deps.armorOf(t),
    thermalSkipsSmoke ? undefined : smokeSet, mods,
  );
  const result = resolveShot(preview, weapon, null, state.rng, mods);
  // Sidearms never end the turn even if the primary's flag is set.
  const apSpent = (!useSidearm && weapon.endsTurn) ? u.ap : weapon.apCost;
  // Reactive Grip refunds the round on a crit — tracked for HUD log too.
  const ammoRefund = result.kind === 'hit' && result.ammoRefund;
  let units = state.units.map((o) =>
    o.id === u.id
      ? { ...o, ap: o.ap - apSpent, [ammoField]: o[ammoField] - (ammoRefund ? 0 : 1),
          status: { ...o.status, overwatch: false } }
      : o,
  );
  let kills = state.kills;
  const floaters = [...state.floaters];
  const fireEvents = [...state.fireEvents, {
    id: nextFireEventId(),
    shooterId: u.id,
    shooterPos: u.pos,
    targetPos: t.pos,
    fireClass: deps.fireClassFor(u, weapon),
  }];
  let entry: LogEntry;
  const verb = useSidearm ? `draws ${weapon.name} and ` : '';
  if (result.kind === 'miss') {
    const burstMissTag = result.burstRounds ? ` — 0/${result.burstRounds} rounds hit` : '';
    entry = {
      id: nextLogId(),
      text: `${u.name} ${verb}misses ${t.name} (${preview.hitChance}%)${burstMissTag}.`,
      kind: 'miss',
    };
    floaters.push(deps.floaterFor(t.pos, 'MISS', 0x6b7689));
  } else {
    // Ranger's Mark adds +3 damage to the first incoming hit, then the
    // mark clears. Applied BEFORE HP clamp so the bonus is real and the
    // "rounds hit" log stays honest about the weapon roll.
    const markBonus = t.status.marked ? 3 : 0;
    const effDamage = result.damage + markBonus;
    const newHp = Math.max(0, t.hp - effDamage);
    const died = newHp <= 0;
    // Heavy weapons suppress their target on hit — hosing the target
    // with a burst puts their head down. Cleared at end of enemy turn.
    const suppresses = !died && weapon.class === 'heavy';
    units = units.map((o) => o.id === t.id
      ? { ...o, hp: newHp, alive: !died,
          status: { ...o.status, marked: false,
            suppressed: suppresses ? true : o.status.suppressed } }
      : o);
    if (died) kills += 1;
    const refundTag = ammoRefund ? ' (round salvaged)' : '';
    const burstTag = result.hits && result.burstRounds
      ? ` — ${result.hits}/${result.burstRounds} rounds hit`
      : '';
    const markTag = markBonus > 0 ? ' (marked +3)' : '';
    entry = {
      id: nextLogId(),
      text: `${u.name} ${verb}${result.critical ? 'critically ' : ''}hits ${t.name} for ${effDamage}${markTag}${burstTag}${refundTag}${died ? ' — eliminated!' : ''}.`,
      kind: died ? 'kill' : result.critical ? 'crit' : 'hit',
    };
    floaters.push(deps.floaterFor(t.pos, `-${effDamage}`, result.critical ? 0xff9a3c : 0x57d18b));
  }

  // Build the authoritative shot event + optional unit-down follow-up.
  const hit = result.kind === 'hit';
  const shotEvent: CombatEvent = {
    t: 'shot',
    shooterId: u.id,
    targetId: t.id,
    weaponClass: weapon.class,
    hit,
    damage: hit ? (result.damage + (t.status.marked ? 3 : 0)) : 0,
    critical: hit ? !!result.critical : false,
    hits: hit ? (result.hits ?? 1) : 0,
    burstRounds: result.burstRounds ?? 0,
  };
  const events: CombatEvent[] = [shotEvent];
  if (hit) {
    const newHp = Math.max(0, t.hp - shotEvent.damage);
    if (newHp <= 0) events.push({ t: 'unit-down', unitId: t.id, byId: u.id });
  }

  return {
    units,
    kills,
    log: [...state.log, entry].slice(-60),
    floaters,
    fireEvents,
    combatEventLog: pushEvents(state.combatEventLog, events),
    shakeFrames: hit ? 8 : 0,
    applied: true,
  };
}

// Reference nextFloaterId so the module-level reset path stays wired —
// floaters constructed by the `deps.floaterFor` callback still route
// through runtimeIds under the hood in the store.
void nextFloaterId;

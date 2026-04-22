import { create } from 'zustand';
import type {
  GridMap, LogEntry, MissionObjective, TurnPhase, Unit, UnitId, Utility,
  Vec2, ShotPreview, Weapon, WeaponClass,
} from '../game/types';
import { RUINED_MARKET, pickRandomMap } from '../game/maps';
import {
  useContent, getSoldierTemplate, getEnemyTemplate, getWeapon, getArmor,
  getKit, resolveSpawn, getAbility,
} from '../content/registry';
import { modsFromIds, totalMobilityDeltaFromMods } from '../game/engine/loadout';
import type { ModSlot } from '../game/types';
import { useGameStore } from './gameStore';
import { reachable, findPath } from '../game/engine/pathing';
import { chebyshev, keyOf } from '../game/engine/grid';
import { previewShot } from '../game/engine/combat';
import { hasLineOfSight } from '../game/engine/los';
import { makeRng, type RNG } from '../game/engine/rng';
import { tryAbility as runAbility } from '../game/engine/abilities';
import { resolveUtility } from '../game/engine/utilities';
import { evaluateObjective } from '../game/engine/objectives';
import {
  nextUnitId, nextFloaterId, nextFireEventId,
} from '../game/engine/runtimeIds';
import { pushLog } from '../game/engine/log';
import {
  applyShotResult as runShotPipeline,
  type ShotPipelineDeps,
} from '../game/engine/shotPipeline';
import {
  triggerEnemyOverwatch as runEnemyOverwatch,
  type OverwatchDeps,
} from '../game/engine/overwatch';
import { buildInitialCombatState, type InitMissionDeps } from '../game/engine/mission';
import { advanceDefendCounter, finalizeEnemyTurn } from '../game/engine/turn';
import { runEnemyTurn as runStepObjectEnemyTurn } from '../game/engine/enemyTurn/runner';

export type ActionMode = 'idle' | 'move' | 'fire' | 'sidearm' | 'utility' | 'ability';

// Overwatch accuracy penalties now live in engine/overwatch.ts.

export type Floater = {
  id: number;
  pos: Vec2;     // grid coords where it spawned
  text: string;
  color: number; // pixi color
  ttl: number;   // frames remaining
};

/**
 * Ephemeral shot record. Pushed by every resolver that fires a shot
 * (primary, sidearm, enemy attack, overwatch reaction); drained by the
 * renderer each sync to drive the correct fire choreography aimed at
 * the correct target. The renderer clears the array after consuming it.
 *
 * This is authoritative — the renderer no longer guesses the target
 * from ammo deltas or "nearest enemy" heuristics.
 */
export type FireEvent = {
  id: number;
  shooterId: UnitId;
  /** Grid coord the shooter occupied when the shot resolved. */
  shooterPos: Vec2;
  /** Grid coord of the shot's target. */
  targetPos: Vec2;
  fireClass: WeaponClass;
};

export type CombatState = {
  map: GridMap;
  units: Unit[];
  /** Smoke cloud cells: tile key → rounds remaining. Blocks LOS for both sides. */
  smokeTiles: Map<number, number>;
  selectedId: UnitId | null;
  phase: TurnPhase;
  round: number;
  mode: ActionMode;
  selectedUtilityIdx: number | null;
  log: LogEntry[];
  reach: Map<number, number>;
  rng: RNG;
  // stats
  kills: number;
  damageTaken: number;
  /**
   * True when the current combat is a road-skirmish rather than a real
   * mission. Drives post-combat routing: skirmish victories go back to
   * the excursion map, not to Field Camp (no re-resupply between the
   * skirmish and the next real mission plot point).
   */
  isSkirmish: boolean;
  /** Mission victory condition evaluated by checkEnd. Defaults to eliminate_all. */
  objective: MissionObjective;
  /** Turns the squad has held the defend_point tile. Incremented at
   *  end of player turn when any alive player occupies the goal. */
  defendTurns: number;
  // pending confirm
  pendingShotTargetId: UnitId | null;
  /** When set, the pending shot uses the soldier's sidearm instead of primary. */
  pendingShotUsesSidearm: boolean;
  pendingUtility: { center: Vec2; idx: number } | null;
  // ui ephemera
  shakeFrames: number;
  floaters: Floater[];
  fireEvents: FireEvent[];

  init: () => void;
  selectUnit: (id: UnitId | null) => void;
  setMode: (m: ActionMode, utilityIdx?: number) => void;

  tryMove: (to: Vec2) => boolean;
  queueShot: (targetId: UnitId) => boolean;
  queueSidearmShot: (targetId: UnitId) => boolean;
  queueUtility: (target: Vec2, utilityIdx: number) => boolean;
  confirmPending: () => void;
  cancelPending: () => void;
  tryReload: () => boolean;
  toggleOverwatch: () => boolean;
  /** Mid-mission Field Refit: swap one mod slot for 1 AP. Pass `null` to clear. */
  tryRefit: (slot: ModSlot, useSidearm: boolean, modId: string | null) => boolean;
  /** Data-driven ability dispatcher. Looks up the AbilityDef in the active
   *  content pack; target is a UnitId for enemy-target abilities, a Vec2
   *  for tile-target abilities, or undefined for self-cast. */
  tryAbility: (abilityId: string, target?: UnitId | Vec2) => boolean;
  /** Ranger ability — shim that calls `tryAbility('ranger-mark', id)`. */
  tryRangerMark: (targetId: UnitId) => boolean;
  /** Warden ability — shim that calls `tryAbility('warden-bracing-fire', id)`. */
  tryWardenBracingFire: (targetId: UnitId) => boolean;
  /** Mystic ability — shim that calls `tryAbility('mystic-arcane-sight')`. */
  tryMysticArcaneSight: () => boolean;
  /** Sapper ability — shim that calls `tryAbility('sapper-demolish', pos)`. */
  trySapperDemolish: (pos: Vec2) => boolean;
  endPlayerTurn: () => void;
  runEnemyTurn: () => Promise<void>;
  getShotPreview: (targetId: UnitId, useSidearm?: boolean) => ShotPreview | null;

  /**
   * Excursion-aware init: deploy onto a specific map with optional carry-over
   * per soldier. Falls back to today's pick-random-map + fresh-squad path when
   * called with no args.
   */
  initMission: (opts?: {
    map?: GridMap;
    rosterIds?: string[];
    carries?: Record<string, SoldierCarry>;
    briefing?: string;
    /** Mark as a skirmish so post-combat routing skips Field Camp. */
    isSkirmish?: boolean;
    /** Mission victory condition; defaults to eliminate_all. */
    objective?: MissionObjective;
    /**
     * Per-mission spawn-legend override. Keys in this map take
     * precedence over the active pack's spawnLegend, so a mission or
     * skirmish can remap a map's G/O/T to different enemy templates
     * (e.g. turning a goblin ambush into a berserker charge) without
     * authoring a new map.
     */
    spawnsOverride?: Record<string, string>;
  }) => void;

  /** Snapshot player-unit state for the excursion's squad-carry record. */
  snapshotSquadCarry: () => Array<{
    soldierId: string;
    alive: boolean;
    hp: number;
    ammoPrimary: number;
    ammoSidearm: number;
    utilityCharges: number[];
  }>;
};

// Runtime id counters now live in engine/runtimeIds.ts (module-scoped,
// per-mission reset via resetMissionIds() inside buildInitialCombatState).

function fireClassFor(u: Unit, weapon: Weapon | null): WeaponClass {
  if (weapon) return weapon.class;
  if (u.faction === 'enemy') {
    const tmpl = useContent().enemyTemplates[u.templateId];
    return tmpl?.fireClass ?? 'rifle';
  }
  return 'rifle';
}

/**
 * Per-soldier carry-over applied when spawning into a mission that's part of
 * an ongoing excursion. Lets HP / ammo / charges persist between missions
 * without touching the spawn code path for a fresh campaign deploy.
 */
export interface SoldierCarry {
  hp?: number;                 // if set, starting HP = min(hp, hpMax)
  ammoPrimary?: number;
  ammoSidearm?: number;
  utilityCharges?: number[];
  /** Accumulated grime 0..100. Fed through to Unit.dirt for rendering. */
  dirt?: number;
}

function mkSoldierUnit(templateId: string, carry?: SoldierCarry): Unit {
  const t = getSoldierTemplate(templateId);
  const store = useGameStore.getState();
  const loadout = store.loadouts[templateId] ?? t.defaultLoadout;
  const primary = getWeapon(loadout.primaryId);
  const sidearm = getWeapon(loadout.sidearmId);
  const armor = getArmor(loadout.armorId);
  const kit = loadout.kitId ? getKit(loadout.kitId) : null;
  const k = kit?.effects ?? {};
  // Kit folds into spawn-time stats — no runtime hooks needed in phase 1.
  const hpMax = Math.max(1, t.hpMax + armor.hpBonus + (k.hpBonus ?? 0));
  const utilityChargesMax = loadout.utilityIds.map((id) =>
    (useContent().utilities[id]?.charges ?? 0) + (k.extraUtilityCharges ?? 0)
  );
  // Apply excursion carry-over if provided — otherwise full HP / full magazines.
  const startHp = carry?.hp !== undefined ? Math.max(1, Math.min(hpMax, carry.hp)) : hpMax;
  const utilityCharges = carry?.utilityCharges
    ? utilityChargesMax.map((max, i) => Math.min(max, carry.utilityCharges?.[i] ?? max))
    : utilityChargesMax;
  // Mods can also nudge wielder mobility (heavy stock −1, folding +1, etc.).
  const modMobility = totalMobilityDeltaFromMods(loadout.primaryMods, loadout.sidearmMods);
  const primaryCap = primary.ammo + (k.extraAmmoPrimary ?? 0);
  const sidearmCap = sidearm.ammo + (k.extraAmmoSidearm ?? 0);
  return {
    id: nextUnitId(),
    faction: 'player',
    templateId,
    name: t.name,
    pos: { x: 0, y: 0 },
    hp: startHp,
    hpMax,
    aim: t.aim + (k.aimBonus ?? 0),
    mobility: Math.max(2, t.mobility + armor.mobility + (k.mobilityBonus ?? 0) + modMobility),
    ap: 2, apMax: 2,
    loadout,
    ammo: carry?.ammoPrimary !== undefined ? Math.min(primaryCap, carry.ammoPrimary) : primaryCap,
    sidearmAmmo: carry?.ammoSidearm !== undefined ? Math.min(sidearmCap, carry.ammoSidearm) : sidearmCap,
    utilityCharges,
    // Players don't use innate attack stats — combat resolves through their weapon.
    dmgMin: 0, dmgMax: 0, rangeShort: 0, rangeLong: 0,
    status: { overwatch: false, blinded: false, suppressed: false, marked: false, seeThroughSmoke: false },
    alive: true,
    color: t.portraitColor,
    dirt: carry?.dirt ?? 0,
  };
}

function mkEnemyUnit(templateId: string): Unit {
  const t = getEnemyTemplate(templateId);
  return {
    id: nextUnitId(),
    faction: 'enemy',
    templateId,
    name: t.name,
    pos: { x: 0, y: 0 },
    hp: t.hpMax, hpMax: t.hpMax,
    aim: t.aim,
    mobility: t.mobility,
    ap: 2, apMax: 2,
    ammo: 99,
    sidearmAmmo: 0,
    utilityCharges: [],
    dmgMin: t.dmgMin,
    dmgMax: t.dmgMax,
    rangeShort: t.rangeShort,
    rangeLong: t.rangeLong,
    status: { overwatch: false, blinded: false, suppressed: false, marked: false, seeThroughSmoke: false },
    alive: true,
    color: t.color,
  };
}

/**
 * Non-combatant destructible: a shootable relay / generator / pylon
 * placed by missions with objective.kind === 'destroy_objective'.
 * Uses the 'enemy' faction so existing target-selection routes work
 * (`queueShot` lets the player tap it) but carries role='objective'
 * so `checkEnd` (eliminate_all) ignores it in the win condition.
 */
function mkObjectiveUnit(pos: Vec2, hp: number): Unit {
  return {
    id: nextUnitId(),
    faction: 'enemy',
    templateId: '__objective__',
    name: 'Objective',
    pos,
    hp, hpMax: hp,
    aim: 0, mobility: 0, ap: 0, apMax: 0,
    ammo: 0, sidearmAmmo: 0, utilityCharges: [],
    dmgMin: 0, dmgMax: 0, rangeShort: 0, rangeLong: 0,
    status: { overwatch: false, blinded: false, suppressed: false, marked: false, seeThroughSmoke: false },
    alive: true,
    color: '#e8c488',
    role: 'objective',
  };
}

/**
 * Escort NPC for extract_vip missions. Non-combatant, moves on the
 * player's turn via tryMove (selected like any player unit). Dies to
 * enemy fire — mission lost if that happens before extraction.
 */
function mkVipUnit(pos: Vec2): Unit {
  return {
    id: nextUnitId(),
    faction: 'player',
    templateId: '__vip__',
    name: 'VIP',
    pos,
    hp: 8, hpMax: 8,
    aim: 0, mobility: 3, ap: 2, apMax: 2,
    ammo: 0, sidearmAmmo: 0, utilityCharges: [],
    dmgMin: 0, dmgMax: 0, rangeShort: 0, rangeLong: 0,
    status: { overwatch: false, blinded: false, suppressed: false, marked: false, seeThroughSmoke: false },
    alive: true,
    color: '#c79aff',
    role: 'vip',
  };
}

function unitArmor(u: Unit): number {
  if (!u.loadout) return 0;
  return useContent().armor[u.loadout.armorId]?.dr ?? 0;
}

function unitPrimary(u: Unit) {
  return u.loadout ? getWeapon(u.loadout.primaryId) : null;
}

function unitSidearm(u: Unit) {
  return u.loadout ? getWeapon(u.loadout.sidearmId) : null;
}

function unitUtility(u: Unit, idx: number): Utility | null {
  if (!u.loadout) return null;
  const id = u.loadout.utilityIds[idx];
  return id ? useContent().utilities[id] ?? null : null;
}

/** Equipped mods for a soldier's primary or sidearm. Empty for enemies. */
function unitMods(u: Unit, useSidearm: boolean) {
  if (!u.loadout) return [];
  return modsFromIds(useSidearm ? u.loadout.sidearmMods : u.loadout.primaryMods);
}

// `pushLog` lives in engine/log.ts — imported at the top of this file.

function floaterFor(pos: Vec2, text: string, color: number): Floater {
  return { id: nextFloaterId(), pos, text, color, ttl: 50 };
}

function recalcReach(state: CombatState): Map<number, number> {
  const sel = state.units.find((u) => u.id === state.selectedId);
  if (!sel || sel.faction !== 'player' || !sel.alive || state.phase !== 'player') return new Map();
  const blocked = new Set<number>();
  for (const u of state.units) if (u.alive && u.id !== sel.id) blocked.add(keyOf(u.pos.x, u.pos.y));
  const steps = sel.mobility * sel.ap;
  return reachable(state.map, sel.pos, steps, blocked);
}

/**
 * Evaluate the mission's victory + defeat conditions against current state.
 * Shared loss rule across every objective: a player wipe is always a loss.
 * Victory dispatches on objective.kind:
 *   - eliminate_all     → no enemies left
 *   - eliminate_target  → every unit with the given templateId is dead
 *   - reach_tile        → any alive player stands on pos (turnLimit
 *                         exceeded is a loss if set)
 *   - destroy_objective → the role='objective' unit at pos is dead
 *   - defend_point      → defendTurns >= obj.turns (incremented at
 *                         end-of-player-turn when a player stands on pos)
 *   - extract_vip       → role='vip' unit reaches extractTile alive;
 *                         lost if it dies before then
 */
function checkEnd(state: CombatState): Partial<CombatState> | null {
  const outcome = evaluateObjective(state);
  if (outcome === 'won') return { phase: 'won' };
  if (outcome === 'lost') return { phase: 'lost' };
  return null;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const useCombatStore = create<CombatState>((set, get) => ({
  map: RUINED_MARKET,
  units: [],
  smokeTiles: new Map(),
  selectedId: null,
  phase: 'player',
  round: 1,
  mode: 'idle',
  selectedUtilityIdx: null,
  log: [],
  reach: new Map(),
  rng: makeRng(0xC0FFEE),
  kills: 0,
  damageTaken: 0,
  isSkirmish: false,
  objective: { kind: 'eliminate_all' },
  defendTurns: 0,
  pendingShotTargetId: null,
  pendingShotUsesSidearm: false,
  pendingUtility: null,
  shakeFrames: 0,
  floaters: [],
  fireEvents: [],

  init: () => {
    get().initMission();
  },

  initMission: (opts) => {
    // Delegate to engine/mission.ts. The store wires in pack-aware factories
    // + registry lookups; buildInitialCombatState does the orchestration.
    const deps: InitMissionDeps = {
      pickRandomMap,
      defaultRoster: () => useGameStore.getState().roster,
      mkSoldierUnit,
      mkEnemyUnit,
      mkObjectiveUnit,
      mkVipUnit,
      resolveSpawn,
      makeRng,
    };
    set(buildInitialCombatState(opts ?? {}, deps));
    set((st) => ({ reach: recalcReach(st) }));
  },

  selectUnit: (id) => {
    set({ selectedId: id, mode: 'idle', selectedUtilityIdx: null,
      pendingShotTargetId: null, pendingShotUsesSidearm: false, pendingUtility: null });
    set((st) => ({ reach: recalcReach(st) }));
  },

  setMode: (m, utilityIdx) => set({
    mode: m, selectedUtilityIdx: utilityIdx ?? null,
    pendingShotTargetId: null, pendingShotUsesSidearm: false, pendingUtility: null,
  }),

  tryMove: (to) => {
    const st = get();
    if (st.phase !== 'player') return false;
    const u = st.units.find((x) => x.id === st.selectedId);
    if (!u || !u.alive) return false;
    const k = keyOf(to.x, to.y);
    const d = st.reach.get(k);
    if (d === undefined || d === 0) return false;
    const apCost = Math.ceil(d / u.mobility);
    if (apCost > u.ap) return false;
    const blocked = new Set<number>();
    for (const o of st.units) if (o.alive && o.id !== u.id) blocked.add(keyOf(o.pos.x, o.pos.y));
    const path = findPath(st.map, u.pos, to, blocked);
    if (!path) return false;
    const next = st.units.map((o) => o.id === u.id
      ? { ...o, pos: to, ap: o.ap - apCost, status: { ...o.status, overwatch: false } }
      : o);
    set({ units: next, mode: 'idle' });
    set((s) => ({ reach: recalcReach(s), log: pushLog(s.log, `${u.name} moves.`) }));
    // Enemy overwatch: if the player just stepped into LOS of a
    // watching enemy, trigger their reactive shot. This mirrors the
    // runEnemyTurn triggerOverwatch that already exists for players
    // watching enemies.
    triggerEnemyOverwatch(set, get, u.id);
    // reach_tile missions end when a player foot lands on the goal.
    const end = checkEnd(get());
    if (end) set(end);
    return true;
  },

  queueShot: (targetId) => {
    const st = get();
    if (st.phase !== 'player') return false;
    const u = st.units.find((x) => x.id === st.selectedId);
    const t = st.units.find((x) => x.id === targetId);
    if (!u || !t || !u.alive || !t.alive) return false;
    const w = unitPrimary(u);
    if (!w) return false;
    if (u.ap < w.apCost || u.ammo <= 0) return false;
    // Thermal optic OR Mystic's Arcane Sight status ignores smoke.
    const mods = unitMods(u, false);
    const seesSmoke = u.status.seeThroughSmoke
      || mods.some((m) => m.effects.flags?.includes('thermal'));
    const blockers = seesSmoke ? undefined : new Set(st.smokeTiles.keys());
    if (!hasLineOfSight(st.map, u.pos, t.pos, blockers)) return false;
    set({ pendingShotTargetId: targetId, pendingShotUsesSidearm: false, mode: 'fire' });
    return true;
  },

  queueSidearmShot: (targetId) => {
    const st = get();
    if (st.phase !== 'player') return false;
    const u = st.units.find((x) => x.id === st.selectedId);
    const t = st.units.find((x) => x.id === targetId);
    if (!u || !t || !u.alive || !t.alive) return false;
    const w = unitSidearm(u);
    if (!w) return false;
    if (u.ap < w.apCost || u.sidearmAmmo <= 0) return false;
    const mods = unitMods(u, true);
    const seesSmoke = u.status.seeThroughSmoke
      || mods.some((m) => m.effects.flags?.includes('thermal'));
    const blockers = seesSmoke ? undefined : new Set(st.smokeTiles.keys());
    if (!hasLineOfSight(st.map, u.pos, t.pos, blockers)) return false;
    set({ pendingShotTargetId: targetId, pendingShotUsesSidearm: true, mode: 'sidearm' });
    return true;
  },

  queueUtility: (center, utilityIdx) => {
    const st = get();
    if (st.phase !== 'player') return false;
    const u = st.units.find((x) => x.id === st.selectedId);
    if (!u || !u.alive) return false;
    const util = unitUtility(u, utilityIdx);
    if (!util) return false;
    if (u.ap < util.apCost) return false;
    if ((u.utilityCharges[utilityIdx] ?? 0) <= 0) return false;
    if (chebyshev(u.pos, center) > util.range) return false;
    set({ pendingUtility: { center, idx: utilityIdx }, mode: 'utility', selectedUtilityIdx: utilityIdx });
    return true;
  },

  cancelPending: () => set({ pendingShotTargetId: null, pendingShotUsesSidearm: false, pendingUtility: null }),

  confirmPending: () => {
    const st = get();
    if (st.pendingShotTargetId !== null) {
      if (st.pendingShotUsesSidearm) {
        resolvePlayerSidearm(set, get, st.selectedId!, st.pendingShotTargetId);
      } else {
        resolvePlayerShot(set, get, st.selectedId!, st.pendingShotTargetId);
      }
      return;
    }
    if (st.pendingUtility) {
      resolvePlayerUtility(set, get, st.selectedId!, st.pendingUtility.center, st.pendingUtility.idx);
    }
  },

  tryReload: () => {
    const st = get();
    const u = st.units.find((x) => x.id === st.selectedId);
    if (!u || !u.alive || u.ap < 1) return false;
    const primary = unitPrimary(u);
    const sidearm = unitSidearm(u);
    if (!primary) return false;
    // Honour the kit's extra-ammo bonuses — otherwise reload would shrink the magazine.
    const kit = u.loadout?.kitId ? getKit(u.loadout.kitId) : null;
    const primaryCap = primary.ammo + (kit?.effects.extraAmmoPrimary ?? 0);
    const sidearmCap = (sidearm?.ammo ?? 0) + (kit?.effects.extraAmmoSidearm ?? 0);
    // Reload tops up both weapons (one action covers the loadout).
    const units = st.units.map((o) => o.id === u.id
      ? { ...o, ammo: primaryCap, sidearmAmmo: sidearmCap,
          ap: o.ap - 1, status: { ...o.status, overwatch: false } }
      : o);
    set({ units, log: pushLog(st.log, `${u.name} reloads.`) });
    return true;
  },

  tryRefit: (slot, useSidearm, modId) => {
    const st = get();
    if (st.phase !== 'player') return false;
    const u = st.units.find((x) => x.id === st.selectedId);
    if (!u || !u.alive || !u.loadout) return false;
    if (u.status.overwatch) return false; // can't tinker while watching
    if (u.ap < 1) return false;
    // Apply the swap and decrement 1 AP. Mod choice isn't validated here —
    // the picker UI is responsible for offering only fits-compatible mods.
    const slotMap = useSidearm ? { ...u.loadout.sidearmMods } : { ...u.loadout.primaryMods };
    if (modId === null) delete slotMap[slot];
    else slotMap[slot] = modId;
    const nextLoadout = useSidearm
      ? { ...u.loadout, sidearmMods: slotMap }
      : { ...u.loadout, primaryMods: slotMap };
    const units = st.units.map((o) => o.id === u.id
      ? { ...o, loadout: nextLoadout, ap: o.ap - 1 }
      : o);
    const verb = modId === null ? 'removes' : 'fits';
    set({ units, log: pushLog(st.log, `${u.name} ${verb} a mod (Field Refit).`) });
    return true;
  },

  // Single data-driven ability dispatcher. Looks up the AbilityDef in the
  // active content pack, validates class gate + AP/ammo/target/range/LOS via
  // the engine helper, then applies the returned patch. AP + overwatch clear
  // + mode reset are handled uniformly here; individual abilities only emit
  // their own specific unit/map/log changes.
  tryAbility: (abilityId, target) => {
    const st = get();
    if (st.phase !== 'player') return false;
    const actor = st.units.find((x) => x.id === st.selectedId && x.alive);
    if (!actor) return false;
    const def = getAbility(abilityId);
    if (!def) return false;
    if (def.classId) {
      const tmpl = getSoldierTemplate(actor.templateId);
      if (tmpl.class !== def.classId) return false;
    }
    const result = runAbility(st, def, actor.id, target);
    if (!result) return false;
    // Apply the ability's patch, then consume AP/ammo + clear overwatch on
    // the actor. The ability's `units` patch is authoritative for every
    // unit EXCEPT the actor's AP/ammo, which we manage here.
    const units = (result.units ?? st.units).map((o) =>
      o.id === actor.id
        ? {
            ...o,
            ap: o.ap - def.apCost,
            ammo: def.ammoCost ? Math.max(0, o.ammo - def.ammoCost) : o.ammo,
            status: { ...o.status, overwatch: false },
          }
        : o,
    );
    const logs = result.logs ?? [];
    let newLog = st.log;
    for (const msg of logs) newLog = pushLog(newLog, msg);
    set({
      units,
      mode: 'idle',
      ...(result.map ? { map: result.map } : {}),
      ...(result.fireEvents ? {
        fireEvents: [
          ...st.fireEvents,
          ...result.fireEvents.map((e) => ({ ...e, id: nextFireEventId() })),
        ],
      } : {}),
      log: newLog,
    });
    set((s) => ({ reach: recalcReach(s) }));
    const end = checkEnd(get());
    if (end) set(end);
    return true;
  },

  // Thin shims — external callers (handleTap, HUD, tests) keep calling these
  // by name; they all delegate to the single registry dispatch above.
  tryRangerMark: (targetId) => get().tryAbility('ranger-mark', targetId),
  tryWardenBracingFire: (targetId) => get().tryAbility('warden-bracing-fire', targetId),
  tryMysticArcaneSight: () => get().tryAbility('mystic-arcane-sight', undefined),
  trySapperDemolish: (pos) => get().tryAbility('sapper-demolish', pos),

  toggleOverwatch: () => {
    const st = get();
    const u = st.units.find((x) => x.id === st.selectedId);
    if (!u || !u.alive) return false;
    if (u.status.overwatch) {
      const units = st.units.map((o) => o.id === u.id ? { ...o, status: { ...o.status, overwatch: false } } : o);
      set({ units });
      return true;
    }
    if (u.ap < 1) return false;
    const units = st.units.map((o) => o.id === u.id ? { ...o, ap: 0, status: { ...o.status, overwatch: true } } : o);
    set({ units, log: pushLog(st.log, `${u.name} enters overwatch.`) });
    return true;
  },

  endPlayerTurn: () => {
    const st = get();
    if (st.phase !== 'player') return;
    set({ phase: 'enemy', mode: 'idle', selectedUtilityIdx: null,
      pendingShotTargetId: null, pendingShotUsesSidearm: false, pendingUtility: null,
      defendTurns: advanceDefendCounter(st) });
    // If the hold counter just completed the objective, short-circuit.
    const end = checkEnd(get());
    if (end) { set(end); return; }
    void get().runEnemyTurn();
  },

  runEnemyTurn: async () => {
    const isTest = typeof window === 'undefined';
    // Tests short-circuit animation delays so 144+ tests finish in <1s.
    // Production honours the delays `resolveStep` returns so the renderer
    // sees intermediate frames (per-tile movement, post-action breaths).
    const sleepFn = isTest
      ? async () => {}
      : async (ms: number) => { await sleep(ms); };
    const { ended } = await runStepObjectEnemyTurn({
      getState: get,
      applyPatch: (p) => set(p),
      sleep: sleepFn,
      grenadeForTemplate: (tid) => useContent().enemyTemplates[tid]?.grenade,
      stepDeps: {
        overwatch: overwatchDeps,
        armorOf: unitArmor,
        floaterFor,
        fireClassFor,
        burstShotsForTemplate: (tid) => useContent().enemyTemplates[tid]?.burstShots,
      },
    });
    if (ended) return;
    // Reset AP + 1-round statuses + tick smoke. The log line the helper
    // emits includes the round-start cue + optional "smoke dissipates".
    set(finalizeEnemyTurn(get()));
    set((s) => ({ reach: recalcReach(s) }));
    const end = checkEnd(get());
    if (end) set(end);
  },

  getShotPreview: (targetId, useSidearm) => {
    const st = get();
    const u = st.units.find((x) => x.id === st.selectedId);
    const t = st.units.find((x) => x.id === targetId);
    if (!u || !t) return null;
    const w = useSidearm ? unitSidearm(u) : unitPrimary(u);
    if (!w) return null;
    return previewShot(st.map, u, t, w, unitArmor(t),
      new Set(st.smokeTiles.keys()), unitMods(u, !!useSidearm));
  },

  snapshotSquadCarry: () => {
    return get().units
      .filter((u) => u.faction === 'player')
      .map((u) => ({
        soldierId: u.templateId,
        alive: u.alive,
        hp: u.alive ? u.hp : 0,
        ammoPrimary: u.ammo,
        ammoSidearm: u.sidearmAmmo,
        utilityCharges: [...u.utilityCharges],
      }));
  },
}));

// ------- internal resolution helpers -------

type Setter = (partial: Partial<CombatState> | ((s: CombatState) => Partial<CombatState>)) => void;
type Getter = () => CombatState;

/** Deps threaded into the engine shot pipeline. Pack lookups live here. */
const shotDeps: ShotPipelineDeps = {
  armorOf: unitArmor,
  modsOf: unitMods,
  fireClassFor,
  floaterFor,
};

/** Shared shot-resolution path used by both primary and sidearm fire. */
function applyShotResult(
  set: Setter, get: Getter, shooterId: UnitId, targetId: UnitId,
  weapon: Weapon, useSidearm: boolean,
) {
  const patch = runShotPipeline(get(), shooterId, targetId, weapon, useSidearm, shotDeps);
  if (!patch.applied) return;
  set({
    units: patch.units,
    kills: patch.kills,
    log: patch.log,
    floaters: patch.floaters,
    fireEvents: patch.fireEvents,
    mode: 'idle',
    pendingShotTargetId: null,
    pendingShotUsesSidearm: false,
    shakeFrames: patch.shakeFrames,
  });
  set((s) => ({ reach: recalcReach(s) }));
  const end = checkEnd(get());
  if (end) set(end);
}

function resolvePlayerShot(set: Setter, get: Getter, shooterId: UnitId, targetId: UnitId) {
  const u = get().units.find((x) => x.id === shooterId);
  if (!u) return;
  const w = unitPrimary(u);
  if (!w) return;
  applyShotResult(set, get, shooterId, targetId, w, false);
}

function resolvePlayerSidearm(set: Setter, get: Getter, shooterId: UnitId, targetId: UnitId) {
  const u = get().units.find((x) => x.id === shooterId);
  if (!u) return;
  const w = unitSidearm(u);
  if (!w) return;
  applyShotResult(set, get, shooterId, targetId, w, true);
}

function resolvePlayerUtility(set: Setter, get: Getter, userId: UnitId, center: Vec2, idx: number) {
  const st = get();
  const u = st.units.find((x) => x.id === userId);
  if (!u || !u.alive) return;
  const util = unitUtility(u, idx);
  if (!util) return;
  if (u.ap < util.apCost) return;
  if ((u.utilityCharges[idx] ?? 0) <= 0) return;
  if (chebyshev(u.pos, center) > util.range) return;

  // Dispatch into the per-kind resolver. The resolver handles the actual
  // damage/heal/smoke/flashbang math; we wrap the result with AP spend,
  // charge decrement, log-entry construction, and floater IDs.
  const result = resolveUtility({
    actor: u, center, utility: util, state: st, rng: st.rng,
    armorOf: (o) => (o.faction === 'player' ? unitArmor(o) : 0),
  });

  // Append resolver floaters with fresh IDs/TTL.
  const floaters = [...st.floaters, ...result.floaters.map((f) => floaterFor(f.pos, f.text, f.color))];

  // Decrement THIS slot's charge counter + spend AP + clear overwatch on the actor.
  const units = result.units.map((o) => {
    if (o.id !== u.id) return o;
    const charges = [...o.utilityCharges];
    charges[idx] = Math.max(0, (charges[idx] ?? 0) - 1);
    return { ...o, utilityCharges: charges, ap: o.ap - util.apCost,
      status: { ...o.status, overwatch: false } };
  });

  set({
    units,
    kills: st.kills + result.kills,
    mode: 'idle',
    selectedUtilityIdx: null,
    pendingUtility: null,
    log: pushLog(st.log, result.message, result.logKind ?? 'info'),
    shakeFrames: result.shakeFrames,
    floaters,
    ...(result.smokeTiles ? { smokeTiles: result.smokeTiles } : {}),
    ...(result.map ? { map: result.map } : {}),
  });
  set((s) => ({ reach: recalcReach(s) }));
  const end = checkEnd(get());
  if (end) set(end);
}

/**
 * If any overwatching player unit can see `enemyId` and has AP + ammo, fire one
 * reactive shot at a penalized accuracy. Consumes overwatch regardless of hit.
 */
/** Shared deps for both overwatch paths. */
const overwatchDeps: OverwatchDeps = {
  armorOf: unitArmor,
  modsOf: unitMods,
  primaryOf: unitPrimary,
  fireClassFor,
  floaterFor,
  burstShotsForTemplate: (tid) => useContent().enemyTemplates[tid]?.burstShots,
};

/**
 * Thin store wrapper for enemy overwatch — the player-move path reads
 * this when a player steps into an overwatching enemy's LOS. The enemy-
 * move path uses triggerPlayerOverwatch directly via the step runner.
 */
function triggerEnemyOverwatch(set: Setter, get: Getter, playerId: UnitId): boolean {
  const patch = runEnemyOverwatch(get(), playerId, overwatchDeps);
  if (!patch.triggered) return false;
  set({
    units: patch.units, kills: patch.kills, damageTaken: patch.damageTaken,
    floaters: patch.floaters, fireEvents: patch.fireEvents, log: patch.log,
    shakeFrames: patch.shakeFrames,
  });
  return true;
}

// Enemy grenade throw logic now lives in engine/enemyTurn/steps.ts
// (resolveThrow) — called from the step runner via resolveStep.

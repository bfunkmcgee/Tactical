import { create } from 'zustand';
import type { GridMap, LogEntry, TurnPhase, Unit, UnitId, Utility, Vec2, ShotPreview, Weapon } from '../game/types';
import { RUINED_MARKET, pickRandomMap } from '../game/data/maps';
import { SOLDIERS } from '../game/data/soldiers';
import { ENEMIES } from '../game/data/enemies';
import { WEAPONS } from '../game/data/weapons';
import { ARMOR } from '../game/data/armor';
import { UTILITIES } from '../game/data/utilities';
import { KITS } from '../game/data/kits';
import { modsFromIds, totalMobilityDeltaFromMods } from '../game/engine/loadout';
import type { ModSlot } from '../game/types';
import { useGameStore } from './gameStore';
import { reachable, findPath } from '../game/engine/pathing';
import { chebyshev, keyOf } from '../game/engine/grid';
import { previewShot, resolveShot, resolveEnemyAttack } from '../game/engine/combat';
import { hasLineOfSight } from '../game/engine/los';
import { makeRng, type RNG } from '../game/engine/rng';
import { decide } from '../game/engine/ai';

export type ActionMode = 'idle' | 'move' | 'fire' | 'sidearm' | 'utility';

/** Smoke cloud lifetime (in player rounds) before it dissipates. */
const SMOKE_DURATION = 2;
/** Overwatch reaction-fire accuracy penalty. */
const OVERWATCH_HIT_PENALTY = 15;
const OVERWATCH_CRIT_PENALTY = 10;

export type Floater = {
  id: number;
  pos: Vec2;     // grid coords where it spawned
  text: string;
  color: number; // pixi color
  ttl: number;   // frames remaining
};

type CombatState = {
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
  // pending confirm
  pendingShotTargetId: UnitId | null;
  /** When set, the pending shot uses the soldier's sidearm instead of primary. */
  pendingShotUsesSidearm: boolean;
  pendingUtility: { center: Vec2; idx: number } | null;
  // ui ephemera
  shakeFrames: number;
  floaters: Floater[];

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
  endPlayerTurn: () => void;
  runEnemyTurn: () => Promise<void>;
  getShotPreview: (targetId: UnitId, useSidearm?: boolean) => ShotPreview | null;
};

let nextUnitId = 1;
let nextLogId = 1;
let nextFloaterId = 1;

function mkSoldierUnit(templateId: string): Unit {
  const t = SOLDIERS[templateId]!;
  const store = useGameStore.getState();
  const loadout = store.loadouts[templateId] ?? t.defaultLoadout;
  const primary = WEAPONS[loadout.primaryId]!;
  const sidearm = WEAPONS[loadout.sidearmId]!;
  const armor = ARMOR[loadout.armorId]!;
  const kit = loadout.kitId ? KITS[loadout.kitId] : null;
  const k = kit?.effects ?? {};
  // Kit folds into spawn-time stats — no runtime hooks needed in phase 1.
  const hpMax = Math.max(1, t.hpMax + armor.hpBonus + (k.hpBonus ?? 0));
  const utilityCharges = loadout.utilityIds.map((id) =>
    (UTILITIES[id]?.charges ?? 0) + (k.extraUtilityCharges ?? 0)
  );
  // Mods can also nudge wielder mobility (heavy stock −1, folding +1, etc.).
  const modMobility = totalMobilityDeltaFromMods(loadout.primaryMods, loadout.sidearmMods);
  return {
    id: nextUnitId++,
    faction: 'player',
    templateId,
    name: t.name,
    pos: { x: 0, y: 0 },
    hp: hpMax,
    hpMax,
    aim: t.aim + (k.aimBonus ?? 0),
    mobility: Math.max(2, t.mobility + armor.mobility + (k.mobilityBonus ?? 0) + modMobility),
    ap: 2, apMax: 2,
    loadout,
    ammo: primary.ammo + (k.extraAmmoPrimary ?? 0),
    sidearmAmmo: sidearm.ammo + (k.extraAmmoSidearm ?? 0),
    utilityCharges,
    // Players don't use innate attack stats — combat resolves through their weapon.
    dmgMin: 0, dmgMax: 0, rangeShort: 0, rangeLong: 0,
    status: { overwatch: false, blinded: false, suppressed: false },
    alive: true,
    color: t.portraitColor,
  };
}

function mkEnemyUnit(templateId: string): Unit {
  const t = ENEMIES[templateId]!;
  return {
    id: nextUnitId++,
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
    status: { overwatch: false, blinded: false, suppressed: false },
    alive: true,
    color: t.color,
  };
}

function unitArmor(u: Unit): number {
  if (!u.loadout) return 0;
  return ARMOR[u.loadout.armorId]?.dr ?? 0;
}

function unitPrimary(u: Unit) {
  return u.loadout ? WEAPONS[u.loadout.primaryId]! : null;
}

function unitSidearm(u: Unit) {
  return u.loadout ? WEAPONS[u.loadout.sidearmId]! : null;
}

function unitUtility(u: Unit, idx: number): Utility | null {
  if (!u.loadout) return null;
  const id = u.loadout.utilityIds[idx];
  return id ? UTILITIES[id] ?? null : null;
}

/** Equipped mods for a soldier's primary or sidearm. Empty for enemies. */
function unitMods(u: Unit, useSidearm: boolean) {
  if (!u.loadout) return [];
  return modsFromIds(useSidearm ? u.loadout.sidearmMods : u.loadout.primaryMods);
}

function pushLog(log: LogEntry[], text: string, kind: LogEntry['kind'] = 'info'): LogEntry[] {
  return [...log, { id: nextLogId++, text, kind }].slice(-60);
}

function floaterFor(pos: Vec2, text: string, color: number): Floater {
  return { id: nextFloaterId++, pos, text, color, ttl: 50 };
}

function recalcReach(state: CombatState): Map<number, number> {
  const sel = state.units.find((u) => u.id === state.selectedId);
  if (!sel || sel.faction !== 'player' || !sel.alive || state.phase !== 'player') return new Map();
  const blocked = new Set<number>();
  for (const u of state.units) if (u.alive && u.id !== sel.id) blocked.add(keyOf(u.pos.x, u.pos.y));
  const steps = sel.mobility * sel.ap;
  return reachable(state.map, sel.pos, steps, blocked);
}

function checkEnd(state: CombatState): Partial<CombatState> | null {
  const aliveP = state.units.some((u) => u.faction === 'player' && u.alive);
  const aliveE = state.units.some((u) => u.faction === 'enemy' && u.alive);
  if (!aliveE) return { phase: 'won' };
  if (!aliveP) return { phase: 'lost' };
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
  pendingShotTargetId: null,
  pendingShotUsesSidearm: false,
  pendingUtility: null,
  shakeFrames: 0,
  floaters: [],

  init: () => {
    nextUnitId = 1; nextLogId = 1; nextFloaterId = 1;
    const roster = useGameStore.getState().roster;
    const map = pickRandomMap();
    const units: Unit[] = [];
    roster.forEach((id, i) => {
      const u = mkSoldierUnit(id);
      u.pos = map.playerSpawns[i % map.playerSpawns.length];
      units.push(u);
    });
    for (const es of map.enemySpawns) {
      const e = mkEnemyUnit(es.enemyId);
      e.pos = es.pos;
      units.push(e);
    }
    set({
      map,
      units,
      smokeTiles: new Map(),
      selectedId: units[0]?.id ?? null,
      phase: 'player',
      round: 1,
      mode: 'idle',
      selectedUtilityIdx: null,
      pendingShotTargetId: null,
      pendingShotUsesSidearm: false,
      pendingUtility: null,
      log: [{ id: nextLogId++, text: `Mission: ${map.name}. Neutralize all hostiles.`, kind: 'info' }],
      rng: makeRng(Date.now() & 0xffffffff),
      kills: 0, damageTaken: 0, floaters: [],
    });
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
    // Thermal optic ignores smoke for the LOS check.
    const mods = unitMods(u, false);
    const blockers = mods.some((m) => m.effects.flags?.includes('thermal'))
      ? undefined : new Set(st.smokeTiles.keys());
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
    const blockers = mods.some((m) => m.effects.flags?.includes('thermal'))
      ? undefined : new Set(st.smokeTiles.keys());
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
    const kit = u.loadout?.kitId ? KITS[u.loadout.kitId] : null;
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
      pendingShotTargetId: null, pendingShotUsesSidearm: false, pendingUtility: null });
    void get().runEnemyTurn();
  },

  runEnemyTurn: async () => {
    const isTest = typeof window === 'undefined';
    const delay = isTest ? 0 : 220;
    const smokeSet = () => new Set(get().smokeTiles.keys());
    const enemies = get().units.filter((u) => u.faction === 'enemy' && u.alive);
    for (const eSnap of enemies) {
      let actor = get().units.find((u) => u.id === eSnap.id);
      while (actor && actor.alive && actor.ap > 0) {
        const intent = decide(get().map, actor, get().units, smokeSet());
        if (intent.kind === 'wait') break;
        if (intent.kind === 'move') {
          const steps = Math.min(intent.path.length - 1, actor.mobility * actor.ap);
          if (steps <= 0) break;
          const apCost = Math.max(1, Math.ceil(steps / actor.mobility));
          // Step through the path to allow overwatch reactions.
          let stopped = false;
          for (let i = 1; i <= steps; i++) {
            const tile = intent.path[i];
            set({ units: get().units.map((o) => o.id === actor!.id ? { ...o, pos: tile } : o) });
            if (delay) await sleep(Math.floor(delay / 2));
            // Overwatch: first overwatching player unit with LOS gets a reactive shot.
            const triggered = triggerOverwatch(set, get, actor!.id);
            if (triggered) {
              if (delay) await sleep(delay);
              const a2 = get().units.find((u) => u.id === eSnap.id);
              if (!a2 || !a2.alive) { stopped = true; break; }
              actor = a2;
            }
          }
          // Deduct AP for the move (one-time; overwatch reactions don't refund).
          if (!stopped) {
            set({
              units: get().units.map((o) => o.id === eSnap.id ? { ...o, ap: o.ap - apCost } : o),
              log: pushLog(get().log, `${eSnap.name} advances.`),
            });
          }
        } else if (intent.kind === 'attack') {
          const target = get().units.find((u) => u.id === intent.target.id);
          if (!target || !target.alive) break;
          const armorDr = target.faction === 'player' ? unitArmor(target) : 0;
          const result = resolveEnemyAttack(get().map, actor, target, armorDr, get().rng, smokeSet());
          let units = get().units.map((o) => o.id === actor!.id ? { ...o, ap: o.ap - 1 } : o);
          let damageTaken = get().damageTaken;
          let entry: LogEntry;
          const floaters = [...get().floaters];
          if (result.kind === 'miss') {
            entry = { id: nextLogId++, text: `${actor.name} misses ${target.name} (${result.preview.hitChance}%).`, kind: 'miss' };
            floaters.push(floaterFor(target.pos, 'MISS', 0x6b7689));
          } else {
            const newHp = Math.max(0, target.hp - result.damage);
            const died = newHp <= 0;
            units = units.map((o) => o.id === target.id ? { ...o, hp: newHp, alive: !died } : o);
            if (target.faction === 'player') damageTaken += result.damage;
            entry = {
              id: nextLogId++,
              text: `${actor.name} ${result.critical ? 'critically ' : ''}hits ${target.name} for ${result.damage}${died ? ' — down!' : ''}.`,
              kind: died ? 'kill' : result.critical ? 'crit' : 'hit',
            };
            floaters.push(floaterFor(target.pos, `-${result.damage}`, result.critical ? 0xff9a3c : 0xff5a6a));
          }
          set({ units, damageTaken, log: [...get().log, entry].slice(-60), shakeFrames: result.kind === 'hit' ? 8 : 0, floaters });
          if (delay) await sleep(delay);
          const end = checkEnd(get());
          if (end) { set(end); return; }
        }
        actor = get().units.find((u) => u.id === eSnap.id);
      }
    }
    // Reset AP, clear short-lived statuses, and tick smoke clouds down.
    const units = get().units.map((u) => u.alive
      ? { ...u, ap: u.apMax, status: { ...u.status, blinded: false, suppressed: false } }
      : u);
    const nextSmoke = new Map<number, number>();
    let dissipated = 0;
    for (const [k, rounds] of get().smokeTiles) {
      if (rounds > 1) nextSmoke.set(k, rounds - 1);
      else dissipated++;
    }
    set({ units, phase: 'player', round: get().round + 1, smokeTiles: nextSmoke });
    set((s) => ({ reach: recalcReach(s),
      log: pushLog(s.log, dissipated > 0
        ? `Round ${s.round} — smoke dissipates. Your turn.`
        : `Round ${s.round} — your turn.`) }));
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
}));

// ------- internal resolution helpers -------

type Setter = (partial: Partial<CombatState> | ((s: CombatState) => Partial<CombatState>)) => void;
type Getter = () => CombatState;

/** Shared shot-resolution path used by both primary and sidearm fire. */
function applyShotResult(
  set: Setter, get: Getter, shooterId: UnitId, targetId: UnitId,
  weapon: Weapon, useSidearm: boolean
) {
  const st = get();
  const u = st.units.find((x) => x.id === shooterId);
  const t = st.units.find((x) => x.id === targetId);
  if (!u || !t || !u.alive || !t.alive) return;
  const ammoField = useSidearm ? 'sidearmAmmo' : 'ammo';
  if (u.ap < weapon.apCost || u[ammoField] <= 0) return;

  const mods = unitMods(u, useSidearm);
  const thermalSkipsSmoke = mods.some((m) => m.effects.flags?.includes('thermal'));
  const smokeSet = new Set(st.smokeTiles.keys());
  const losBlockers = thermalSkipsSmoke ? undefined : smokeSet;
  if (!hasLineOfSight(st.map, u.pos, t.pos, losBlockers)) return;

  const preview = previewShot(st.map, u, t, weapon, unitArmor(t),
    thermalSkipsSmoke ? undefined : smokeSet, mods);
  const result = resolveShot(preview, weapon, null, st.rng, mods);
  // Sidearms never end the turn even if the primary's flag is set.
  const apSpent = (!useSidearm && weapon.endsTurn) ? u.ap : weapon.apCost;
  // Reactive Grip refunds the round on a crit — track for HUD log too.
  const ammoRefund = result.kind === 'hit' && result.ammoRefund;
  let units = st.units.map((o) =>
    o.id === u.id
      ? { ...o, ap: o.ap - apSpent, [ammoField]: o[ammoField] - (ammoRefund ? 0 : 1),
          status: { ...o.status, overwatch: false } }
      : o
  );
  let kills = st.kills;
  const floaters = [...st.floaters];
  let entry: LogEntry;
  const verb = useSidearm ? `draws ${weapon.name} and ` : '';
  if (result.kind === 'miss') {
    entry = { id: nextLogId++, text: `${u.name} ${verb}misses ${t.name} (${preview.hitChance}%).`, kind: 'miss' };
    floaters.push(floaterFor(t.pos, 'MISS', 0x6b7689));
  } else {
    const newHp = Math.max(0, t.hp - result.damage);
    const died = newHp <= 0;
    units = units.map((o) => o.id === t.id ? { ...o, hp: newHp, alive: !died } : o);
    if (died) kills += 1;
    const refundTag = ammoRefund ? ' (round salvaged)' : '';
    entry = {
      id: nextLogId++,
      text: `${u.name} ${verb}${result.critical ? 'critically ' : ''}hits ${t.name} for ${result.damage}${refundTag}${died ? ' — eliminated!' : ''}.`,
      kind: died ? 'kill' : result.critical ? 'crit' : 'hit',
    };
    floaters.push(floaterFor(t.pos, `-${result.damage}`, result.critical ? 0xff9a3c : 0x57d18b));
  }
  set({ units, kills, log: [...st.log, entry].slice(-60),
    mode: 'idle', pendingShotTargetId: null, pendingShotUsesSidearm: false,
    shakeFrames: result.kind === 'hit' ? 8 : 0, floaters });
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

  let units = [...st.units];
  let kills = st.kills;
  let msg = '';
  const floaters = [...st.floaters];
  let nextSmoke: Map<number, number> | null = null;

  if (util.kind === 'grenade' && util.dmgMin !== undefined && util.dmgMax !== undefined) {
    const dmgMin = util.dmgMin!, dmgMax = util.dmgMax!;
    const victims: Unit[] = [];
    for (const other of units) {
      if (!other.alive) continue;
      if (chebyshev(other.pos, center) <= util.radius) victims.push(other);
    }
    units = units.map((o) => {
      if (!victims.find((v) => v.id === o.id)) return o;
      const dr = o.faction === 'player' ? unitArmor(o) : 0;
      const dmg = Math.max(1, (dmgMin + st.rng.int(dmgMax - dmgMin + 1)) - dr);
      const newHp = Math.max(0, o.hp - dmg);
      const died = newHp <= 0;
      if (died && o.faction === 'enemy') kills += 1;
      floaters.push(floaterFor(o.pos, `-${dmg}`, 0xff9a3c));
      return { ...o, hp: newHp, alive: !died };
    });
    msg = `${u.name} throws ${util.name} — ${victims.length} caught in the blast.`;
  } else if (util.kind === 'flashbang') {
    units = units.map((o) =>
      chebyshev(o.pos, center) <= util.radius && o.faction !== u.faction && o.alive
        ? { ...o, status: { ...o.status, blinded: true } } : o
    );
    msg = `${u.name} pops ${util.name}; foes are blinded.`;
  } else if (util.kind === 'smoke') {
    // Drop smoke tiles in the radius. Each tile blocks LOS for SMOKE_DURATION rounds.
    nextSmoke = new Map(st.smokeTiles);
    let added = 0;
    for (let dy = -util.radius; dy <= util.radius; dy++) {
      for (let dx = -util.radius; dx <= util.radius; dx++) {
        const x = center.x + dx, y = center.y + dy;
        if (Math.max(Math.abs(dx), Math.abs(dy)) > util.radius) continue;
        if (x < 0 || y < 0 || x >= st.map.width || y >= st.map.height) continue;
        const tile = st.map.tiles[y * st.map.width + x];
        if (!tile || tile.kind === 'wall') continue;
        nextSmoke.set(keyOf(x, y), SMOKE_DURATION);
        added++;
      }
    }
    msg = `${u.name} deploys ${util.name}; ${added} tiles of smoke roll out.`;
  } else if (util.kind === 'medkit' && util.heal) {
    const heal = util.heal!;
    units = units.map((o) => {
      if (!o.alive) return o;
      if (chebyshev(o.pos, center) > 1) return o;
      if (o.faction !== 'player') return o;
      const healed = Math.min(o.hpMax, o.hp + heal);
      floaters.push(floaterFor(o.pos, `+${healed - o.hp}`, 0x57d18b));
      return { ...o, hp: healed };
    });
    msg = `${u.name} applies ${util.name}.`;
  }

  // Decrement THIS slot's charge counter (correct even when the same utility is equipped twice).
  units = units.map((o) => {
    if (o.id !== u.id) return o;
    const charges = [...o.utilityCharges];
    charges[idx] = Math.max(0, (charges[idx] ?? 0) - 1);
    return { ...o, utilityCharges: charges, ap: o.ap - util.apCost,
      status: { ...o.status, overwatch: false } };
  });

  set({ units, kills, mode: 'idle', selectedUtilityIdx: null, pendingUtility: null,
    log: pushLog(st.log, msg, util.kind === 'medkit' ? 'heal' : 'info'),
    shakeFrames: util.kind === 'grenade' ? 10 : 0, floaters,
    ...(nextSmoke ? { smokeTiles: nextSmoke } : {}) });
  set((s) => ({ reach: recalcReach(s) }));
  const end = checkEnd(get());
  if (end) set(end);
}

/**
 * If any overwatching player unit can see `enemyId` and has AP + ammo, fire one
 * reactive shot at a penalized accuracy. Consumes overwatch regardless of hit.
 */
function triggerOverwatch(set: Setter, get: Getter, enemyId: UnitId): boolean {
  const st = get();
  const enemy = st.units.find((u) => u.id === enemyId);
  if (!enemy || !enemy.alive) return false;
  const smokeSet = new Set(st.smokeTiles.keys());
  // Find the first overwatching player who can see through smoke (thermal mod
  // bypasses smoke for that watcher).
  const watcher = st.units.find((u) => {
    if (u.faction !== 'player' || !u.alive || !u.status.overwatch || u.ammo <= 0) return false;
    const mods = unitMods(u, false);
    const blockers = mods.some((m) => m.effects.flags?.includes('thermal'))
      ? undefined : smokeSet;
    return hasLineOfSight(st.map, u.pos, enemy.pos, blockers);
  });
  if (!watcher) return false;
  const weapon = unitPrimary(watcher);
  if (!weapon) return false;
  const watcherMods = unitMods(watcher, false);
  const watcherSmoke = watcherMods.some((m) => m.effects.flags?.includes('thermal'))
    ? undefined : smokeSet;
  const base = previewShot(st.map, watcher, enemy, weapon, 0, watcherSmoke, watcherMods);
  const preview: ShotPreview = { ...base,
    hitChance: Math.max(1, base.hitChance - OVERWATCH_HIT_PENALTY),
    critChance: Math.max(0, base.critChance - OVERWATCH_CRIT_PENALTY) };
  const result = resolveShot(preview, weapon, null, st.rng, watcherMods);
  let units = st.units.map((o) => o.id === watcher.id
    ? { ...o, ammo: o.ammo - 1, status: { ...o.status, overwatch: false } } : o);
  const floaters = [...st.floaters];
  let entry: LogEntry;
  let kills = st.kills;
  if (result.kind === 'miss') {
    entry = { id: nextLogId++, text: `${watcher.name} reacts — misses ${enemy.name}.`, kind: 'miss' };
    floaters.push(floaterFor(enemy.pos, 'MISS', 0xf5c55a));
  } else {
    const newHp = Math.max(0, enemy.hp - result.damage);
    const died = newHp <= 0;
    units = units.map((o) => o.id === enemy.id ? { ...o, hp: newHp, alive: !died } : o);
    if (died) kills += 1;
    entry = {
      id: nextLogId++,
      text: `${watcher.name} reacts — ${result.critical ? 'crits ' : 'hits '}${enemy.name} for ${result.damage}${died ? ' — eliminated!' : ''}.`,
      kind: died ? 'kill' : result.critical ? 'crit' : 'hit',
    };
    floaters.push(floaterFor(enemy.pos, `-${result.damage}`, 0xf5c55a));
  }
  set({ units, kills, floaters, log: [...st.log, entry].slice(-60), shakeFrames: result.kind === 'hit' ? 8 : 0 });
  return true;
}

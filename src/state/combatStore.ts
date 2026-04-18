import { create } from 'zustand';
import type { GridMap, LogEntry, TurnPhase, Unit, UnitId, Utility, Vec2 } from '../game/types';
import { RUINED_MARKET } from '../game/data/maps/ruined_market';
import { SOLDIERS } from '../game/data/soldiers';
import { ENEMIES } from '../game/data/enemies';
import { WEAPONS } from '../game/data/weapons';
import { ARMOR } from '../game/data/armor';
import { UTILITIES } from '../game/data/utilities';
import { useGameStore } from './gameStore';
import { reachable, findPath } from '../game/engine/pathing';
import { chebyshev, keyOf } from '../game/engine/grid';
import { previewShot, resolveShot, resolveEnemyAttack } from '../game/engine/combat';
import { hasLineOfSight } from '../game/engine/los';
import { makeRng, type RNG } from '../game/engine/rng';
import { decide } from '../game/engine/ai';

export type ActionMode = 'idle' | 'move' | 'fire' | 'utility';

type CombatState = {
  map: GridMap;
  units: Unit[];
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
  // ui ephemera
  shakeFrames: number;

  init: () => void;
  selectUnit: (id: UnitId | null) => void;
  setMode: (m: ActionMode, utilityIdx?: number) => void;

  tryMove: (to: Vec2) => boolean;
  tryShoot: (targetId: UnitId) => boolean;
  tryUtility: (target: Vec2, utilityIdx: number) => boolean;
  tryReload: () => boolean;
  toggleOverwatch: () => boolean;
  endPlayerTurn: () => void;
  runEnemyTurn: () => Promise<void>;
  getShotPreview: (targetId: UnitId) => ReturnType<typeof previewShot> | null;
};

let nextUnitId = 1;
let nextLogId = 1;

function mkSoldierUnit(templateId: string): Unit {
  const t = SOLDIERS[templateId]!;
  const store = useGameStore.getState();
  const loadout = store.loadouts[templateId] ?? t.defaultLoadout;
  const primary = WEAPONS[loadout.primaryId]!;
  const armor = ARMOR[loadout.armorId]!;
  const hpMax = t.hpMax + armor.hpBonus;
  return {
    id: nextUnitId++,
    faction: 'player',
    templateId,
    name: t.name,
    pos: { x: 0, y: 0 },
    hp: hpMax,
    hpMax,
    aim: t.aim,
    mobility: Math.max(2, t.mobility + armor.mobility),
    ap: 2, apMax: 2,
    loadout,
    ammo: primary.ammo,
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

function unitUtility(u: Unit, idx: number): Utility | null {
  if (!u.loadout) return null;
  const id = u.loadout.utilityIds[idx];
  return id ? UTILITIES[id] ?? null : null;
}

function log(state: CombatState, text: string, kind: LogEntry['kind'] = 'info'): LogEntry[] {
  const entry = { id: nextLogId++, text, kind };
  return [...state.log, entry].slice(-60);
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
  shakeFrames: 0,

  init: () => {
    nextUnitId = 1; nextLogId = 1;
    const roster = useGameStore.getState().roster;
    const map = RUINED_MARKET;
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
      selectedId: units[0]?.id ?? null,
      phase: 'player',
      round: 1,
      mode: 'idle',
      selectedUtilityIdx: null,
      log: [{ id: nextLogId++, text: 'Mission: Ruined Market. Neutralize all hostiles.', kind: 'info' }],
      rng: makeRng(Date.now() & 0xffffffff),
      kills: 0, damageTaken: 0,
    });
    set((st) => ({ reach: recalcReach(st) }));
  },

  selectUnit: (id) => {
    set({ selectedId: id, mode: 'idle', selectedUtilityIdx: null });
    set((st) => ({ reach: recalcReach(st) }));
  },

  setMode: (m, utilityIdx) => set({ mode: m, selectedUtilityIdx: utilityIdx ?? null }),

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
    const next = st.units.map((o) => o.id === u.id ? { ...o, pos: to, ap: o.ap - apCost, status: { ...o.status, overwatch: false } } : o);
    set({ units: next, mode: 'idle' });
    set((s) => ({ reach: recalcReach(s), log: log(s, `${u.name} moves.`) }));
    return true;
  },

  tryShoot: (targetId) => {
    const st = get();
    if (st.phase !== 'player') return false;
    const u = st.units.find((x) => x.id === st.selectedId);
    const t = st.units.find((x) => x.id === targetId);
    if (!u || !t || !u.alive || !t.alive) return false;
    const weapon = unitPrimary(u);
    if (!weapon) return false;
    if (u.ap < weapon.apCost) return false;
    if (u.ammo <= 0) return false;
    if (!hasLineOfSight(st.map, u.pos, t.pos)) return false;
    const preview = previewShot(st.map, u, t, weapon, unitArmor(t));
    const result = resolveShot(preview, weapon, null, st.rng);
    const apSpent = weapon.endsTurn ? u.ap : weapon.apCost;
    let units = st.units.map((o) =>
      o.id === u.id ? { ...o, ap: o.ap - apSpent, ammo: o.ammo - 1, status: { ...o.status, overwatch: false } } : o
    );
    let kills = st.kills;
    let entry: LogEntry;
    if (result.kind === 'miss') {
      entry = { id: nextLogId++, text: `${u.name} misses ${t.name} (${preview.hitChance}%).`, kind: 'miss' };
    } else {
      const newHp = Math.max(0, t.hp - result.damage);
      const died = newHp <= 0;
      units = units.map((o) => o.id === t.id ? { ...o, hp: newHp, alive: !died } : o);
      if (died) kills += 1;
      entry = {
        id: nextLogId++,
        text: `${u.name} ${result.critical ? 'critically ' : ''}hits ${t.name} for ${result.damage}${died ? ' — eliminated!' : ''}.`,
        kind: died ? 'kill' : result.critical ? 'crit' : 'hit',
      };
    }
    set({ units, kills, log: [...st.log, entry].slice(-60), mode: 'idle', shakeFrames: result.kind === 'hit' ? 8 : 0 });
    set((s) => ({ reach: recalcReach(s) }));
    const end = checkEnd(get());
    if (end) set(end);
    return true;
  },

  tryUtility: (center, idx) => {
    const st = get();
    if (st.phase !== 'player') return false;
    const u = st.units.find((x) => x.id === st.selectedId);
    if (!u || !u.alive) return false;
    const util = unitUtility(u, idx);
    if (!util) return false;
    if (u.ap < util.apCost || util.charges <= 0) return false;
    if (chebyshev(u.pos, center) > util.range) return false;

    let units = [...st.units];
    let kills = st.kills;
    let msg = '';

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
      // MVP: smoke is narrated only; LOS-blocking smoke clouds can be added later as tile overlay.
      msg = `${u.name} deploys ${util.name}; vision dims where it falls.`;
    } else if (util.kind === 'medkit' && util.heal) {
      const heal = util.heal!;
      units = units.map((o) => {
        if (!o.alive) return o;
        if (chebyshev(o.pos, center) > 1) return o;
        if (o.faction !== 'player') return o;
        return { ...o, hp: Math.min(o.hpMax, o.hp + heal) };
      });
      msg = `${u.name} applies ${util.name}.`;
    }

    // Consume charge + AP + overwatch cancel on acting unit.
    units = units.map((o) => {
      if (o.id !== u.id) return o;
      const newUtilIds = [...(o.loadout?.utilityIds ?? [])];
      // Charges aren't stored per-instance in MVP; we just drop the id once.
      newUtilIds.splice(idx, 1);
      return { ...o, ap: o.ap - util.apCost, status: { ...o.status, overwatch: false }, loadout: o.loadout ? { ...o.loadout, utilityIds: newUtilIds } : o.loadout };
    });

    set({ units, kills, mode: 'idle', selectedUtilityIdx: null,
      log: log({ ...st, units }, msg, util.kind === 'medkit' ? 'heal' : 'info'),
      shakeFrames: util.kind === 'grenade' ? 10 : 0,
    });
    set((s) => ({ reach: recalcReach(s) }));
    const end = checkEnd(get());
    if (end) set(end);
    return true;
  },

  tryReload: () => {
    const st = get();
    const u = st.units.find((x) => x.id === st.selectedId);
    if (!u || !u.alive || u.ap < 1) return false;
    const w = unitPrimary(u);
    if (!w) return false;
    const units = st.units.map((o) => o.id === u.id ? { ...o, ammo: w.ammo, ap: o.ap - 1, status: { ...o.status, overwatch: false } } : o);
    set({ units, log: log(st, `${u.name} reloads.`) });
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
    set({ units, log: log(st, `${u.name} enters overwatch.`) });
    return true;
  },

  endPlayerTurn: () => {
    const st = get();
    if (st.phase !== 'player') return;
    set({ phase: 'enemy', mode: 'idle', selectedUtilityIdx: null });
    void get().runEnemyTurn();
  },

  runEnemyTurn: async () => {
    const isTest = typeof window === 'undefined';
    const delay = isTest ? 0 : 220;
    const enemies = get().units.filter((u) => u.faction === 'enemy' && u.alive);
    for (const eSnap of enemies) {
      let actor = get().units.find((u) => u.id === eSnap.id);
      while (actor && actor.alive && actor.ap > 0) {
        const intent = decide(get().map, actor, get().units);
        if (intent.kind === 'wait') break;
        if (intent.kind === 'move') {
          const steps = Math.min(intent.path.length - 1, actor.mobility * actor.ap);
          const dest = intent.path[steps];
          if (!dest) break;
          const apCost = Math.max(1, Math.ceil(steps / actor.mobility));
          const units = get().units.map((o) => o.id === actor!.id ? { ...o, pos: dest, ap: o.ap - apCost } : o);
          set({ units, log: log(get(), `${actor.name} advances.`) });
          if (delay) await sleep(delay);
        } else if (intent.kind === 'attack') {
          const target = get().units.find((u) => u.id === intent.target.id);
          if (!target || !target.alive) break;
          const armorDr = target.faction === 'player' ? unitArmor(target) : 0;
          const result = resolveEnemyAttack(get().map, actor, target, armorDr, get().rng);
          let units = get().units.map((o) => o.id === actor!.id ? { ...o, ap: o.ap - 1 } : o);
          let damageTaken = get().damageTaken;
          let entry: LogEntry;
          if (result.kind === 'miss') {
            entry = { id: nextLogId++, text: `${actor.name} misses ${target.name} (${result.preview.hitChance}%).`, kind: 'miss' };
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
          }
          set({ units, damageTaken, log: [...get().log, entry].slice(-60), shakeFrames: result.kind === 'hit' ? 8 : 0 });
          if (delay) await sleep(delay);
          const end = checkEnd(get());
          if (end) { set(end); return; }
        }
        actor = get().units.find((u) => u.id === eSnap.id);
      }
    }
    // Reset APs, tick statuses, back to player turn.
    const units = get().units.map((u) => u.alive
      ? { ...u, ap: u.apMax, status: { ...u.status, blinded: false, suppressed: false } }
      : u);
    set({ units, phase: 'player', round: get().round + 1 });
    set((s) => ({ reach: recalcReach(s), log: log(s, `Round ${s.round} — your turn.`) }));
    const end = checkEnd(get());
    if (end) set(end);
  },

  getShotPreview: (targetId) => {
    const st = get();
    const u = st.units.find((x) => x.id === st.selectedId);
    const t = st.units.find((x) => x.id === targetId);
    if (!u || !t) return null;
    const w = unitPrimary(u);
    if (!w) return null;
    return previewShot(st.map, u, t, w, unitArmor(t));
  },
}));

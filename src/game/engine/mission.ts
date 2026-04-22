import type { CombatState, SoldierCarry } from '../../state/combatStore';
import type { GridMap, MissionObjective, Unit, Vec2 } from '../types';
import { resetMissionIds, nextLogId } from './runtimeIds';
import type { CombatEvent } from './events';

/**
 * Mission initialisation — turns an `InitMissionOpts` into the initial
 * `Partial<CombatState>` the store applies.
 *
 * Unit factories are injected via `deps` because they're pack-aware
 * (pulling from soldierTemplates / enemyTemplates / weapons + carry state
 * from the excursion store). This keeps mission.ts free of direct
 * pack/registry imports and foreshadows Enhancement C's EngineDeps
 * seam — the factories become a dependency interface rather than a
 * tangle of module-level singletons.
 */

export type InitMissionOpts = {
  map?: GridMap;
  rosterIds?: string[];
  /** Per-soldier carry state from the excursion system. */
  carries?: Record<string, SoldierCarry>;
  /** Mission-specific spawn-key override (takes precedence over pack legend). */
  spawnsOverride?: Record<string, string>;
  objective?: MissionObjective;
  briefing?: string;
  isSkirmish?: boolean;
};

export type InitMissionDeps = {
  /** Fallback when opts.map isn't set — picks a random engine-owned map. */
  pickRandomMap: () => GridMap;
  /** Fallback when opts.rosterIds isn't set — reads the game store's roster. */
  defaultRoster: () => string[];
  /** Pack-aware factories. */
  mkSoldierUnit: (templateId: string, carry?: SoldierCarry) => Unit;
  mkEnemyUnit: (templateId: string) => Unit;
  mkObjectiveUnit: (pos: Vec2, hp: number) => Unit;
  mkVipUnit: (pos: Vec2) => Unit;
  /** Spawn-key resolver from the active pack (may return undefined on miss). */
  resolveSpawn: (key: string) => string | undefined;
  /** Seeded RNG factory. */
  makeRng: (seed: number) => CombatState['rng'];
};

/**
 * Build the initial combat state for a mission. Pure with respect to
 * `deps` — call-site threading is mechanical (the store passes its helpers).
 * Emits a fresh RNG seeded from `Date.now()` unless the caller overrides.
 */
export function buildInitialCombatState(
  opts: InitMissionOpts,
  deps: InitMissionDeps,
): Partial<CombatState> {
  // Reset unit/log/floater counters so the new mission starts at id 1.
  resetMissionIds();

  const sourceMap = opts.map ?? deps.pickRandomMap();
  // Clone the map + tiles so mid-mission mutations (grenade cover shred,
  // demolish ability) don't bleed back into the engine-owned map singleton.
  const map: GridMap = {
    ...sourceMap,
    tiles: sourceMap.tiles.map((t) => ({ ...t })),
  };
  const roster = opts.rosterIds ?? deps.defaultRoster();
  const carries = opts.carries ?? {};
  const units: Unit[] = [];
  roster.forEach((id, i) => {
    const u = deps.mkSoldierUnit(id, carries[id]);
    u.pos = map.playerSpawns[i % map.playerSpawns.length];
    units.push(u);
  });
  // Mission-specific spawn override > pack legend.
  const spawnOverride = opts.spawnsOverride ?? {};
  for (const es of map.enemySpawns) {
    const enemyId = spawnOverride[es.spawnKey] ?? deps.resolveSpawn(es.spawnKey);
    if (!enemyId) {
      console.warn(`[combat] no spawn legend entry for key '${es.spawnKey}'`);
      continue;
    }
    const e = deps.mkEnemyUnit(enemyId);
    e.pos = es.pos;
    units.push(e);
  }
  // Role-driven special units for non-eliminate objectives. Share the Unit
  // shape so existing combat math (preview/apply/tryMove) handles them.
  const obj = opts.objective ?? { kind: 'eliminate_all' };
  if (obj.kind === 'destroy_objective') {
    units.push(deps.mkObjectiveUnit(obj.pos, obj.hp));
  } else if (obj.kind === 'extract_vip') {
    units.push(deps.mkVipUnit(obj.vipSpawn));
  }

  // Seed the authoritative event log with the mission-start marker.
  // Combined with the RNG seed, replay code can reconstruct every
  // subsequent frame from the sequence of events appended after.
  const seed = Date.now() & 0xffffffff;
  const missionStart: CombatEvent = {
    t: 'mission-start',
    seed,
    missionId: map.id,
    objectiveKind: obj.kind,
  };

  return {
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
    log: [{
      id: nextLogId(),
      text: opts.briefing ?? `Mission: ${map.name}. Neutralize all hostiles.`,
      kind: 'info',
    }],
    rng: deps.makeRng(seed),
    kills: 0,
    damageTaken: 0,
    floaters: [],
    fireEvents: [],
    shakeFrames: 0,
    isSkirmish: opts.isSkirmish ?? false,
    objective: obj,
    defendTurns: 0,
    combatEventLog: [missionStart],
  };
}

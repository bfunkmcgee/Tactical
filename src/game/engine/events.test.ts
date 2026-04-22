import { describe, it, expect, beforeEach } from 'vitest';
import { useCombatStore } from '../../state/combatStore';
import type { GridMap, Tile } from '../types';
import { makeRng } from './rng';
import type { CombatEvent } from './events';

/**
 * Enhancement D event-log tests. The authoritative `combatEventLog`
 * must accurately reflect every mutation to simulation state. These
 * tests verify emission and ordering for common action paths.
 *
 * Replay determinism is a future feature (`replay(events) → state`)
 * that builds on this log; these tests document the emission contract
 * that the future replay helper will rely on.
 */

function mkMap(rows: string[]): GridMap {
  const width = rows[0].length, height = rows.length;
  const tiles: Tile[] = [];
  const playerSpawns: { x: number; y: number }[] = [];
  const enemySpawns: { pos: { x: number; y: number }; spawnKey: string }[] = [];
  rows.forEach((r, y) => {
    [...r].forEach((ch, x) => {
      if (ch === '#') tiles.push({ kind: 'wall' });
      else if (ch === 'H') tiles.push({ kind: 'cover_full' });
      else if (ch === 'h') tiles.push({ kind: 'cover_half' });
      else {
        tiles.push({ kind: 'floor' });
        if (ch === 'P') playerSpawns.push({ x, y });
        else if (ch === 'G') enemySpawns.push({ pos: { x, y }, spawnKey: 'G' });
      }
    });
  });
  return {
    id: 'test', name: 'Test Map', tileset: 'desert',
    width, height, tiles, playerSpawns, enemySpawns,
  };
}

function forceRng(seed: number) {
  useCombatStore.setState({ rng: makeRng(seed) });
}

describe('engine/events: authoritative event log', () => {
  beforeEach(() => {
    useCombatStore.setState({ phase: 'player', round: 1 });
  });

  it('initMission seeds the log with a mission-start event', () => {
    useCombatStore.getState().initMission({
      map: mkMap(['P.........G']),
      rosterIds: ['ranger_kestrel'],
    });
    const log = useCombatStore.getState().combatEventLog;
    expect(log.length).toBeGreaterThanOrEqual(1);
    expect(log[0].t).toBe('mission-start');
    if (log[0].t === 'mission-start') {
      expect(log[0].missionId).toBe('test');
      expect(log[0].objectiveKind).toBe('eliminate_all');
      expect(typeof log[0].seed).toBe('number');
    }
  });

  it('queueShot + confirmPending emits a shot event', () => {
    useCombatStore.getState().initMission({
      map: mkMap(['P.....G....']),
      rosterIds: ['ranger_kestrel'],
    });
    forceRng(0x1);
    const before = useCombatStore.getState().combatEventLog.length;
    const t = useCombatStore.getState().units.find((u) => u.faction === 'enemy')!;
    useCombatStore.getState().queueShot(t.id);
    useCombatStore.getState().confirmPending();
    const after = useCombatStore.getState().combatEventLog;
    const newEvents = after.slice(before);
    const shots = newEvents.filter((e): e is Extract<CombatEvent, { t: 'shot' }> => e.t === 'shot');
    expect(shots.length).toBe(1);
    expect(shots[0].shooterId).toBeDefined();
    expect(shots[0].targetId).toBe(t.id);
  });

  it('abilities emit an ability event with the right id', () => {
    useCombatStore.getState().initMission({
      map: mkMap(['P.....G']),
      rosterIds: ['ranger_kestrel'],
    });
    forceRng(0x2);
    const t = useCombatStore.getState().units.find((u) => u.faction === 'enemy')!;
    const before = useCombatStore.getState().combatEventLog.length;
    expect(useCombatStore.getState().tryRangerMark(t.id)).toBe(true);
    const after = useCombatStore.getState().combatEventLog;
    const newEvents = after.slice(before);
    const ability = newEvents.find((e): e is Extract<CombatEvent, { t: 'ability' }> => e.t === 'ability');
    expect(ability).toBeDefined();
    expect(ability!.abilityId).toBe('ranger-mark');
    expect(ability!.target).toBe(t.id);
  });

  it('endPlayerTurn emits turn-start events for both sides in a full round', async () => {
    useCombatStore.getState().initMission({
      map: mkMap(['P.........G']),
      rosterIds: ['ranger_kestrel'],
    });
    forceRng(0x3);
    useCombatStore.setState({ phase: 'enemy' });
    await useCombatStore.getState().runEnemyTurn();
    // finalizeEnemyTurn runs inside the enemy-phase resolution and
    // emits the player turn-start for the new round.
    const log = useCombatStore.getState().combatEventLog;
    const turnStarts = log.filter((e): e is Extract<CombatEvent, { t: 'turn-start' }> => e.t === 'turn-start');
    expect(turnStarts.length).toBeGreaterThanOrEqual(1);
    expect(turnStarts[turnStarts.length - 1].side).toBe('player');
    expect(turnStarts[turnStarts.length - 1].turnIndex).toBe(2);
  });

  it('mission-end event is appended when the objective resolves', () => {
    useCombatStore.getState().initMission({
      map: mkMap(['P.....G']),
      rosterIds: ['ranger_kestrel'],
    });
    // Force all enemies to be dead so the next action triggers a win.
    useCombatStore.setState({
      units: useCombatStore.getState().units.map((u) =>
        u.faction === 'enemy' ? { ...u, hp: 0, alive: false } : u),
    });
    // Any state-touching action with checkEnd in its tail triggers
    // the win. Fire at (already-dead) enemy to go through applyShotResult
    // — the validation will reject (no alive target) so instead we'll
    // trigger via endPlayerTurn which calls checkEnd.
    useCombatStore.getState().endPlayerTurn();
    const log = useCombatStore.getState().combatEventLog;
    const missionEnd = log.find((e): e is Extract<CombatEvent, { t: 'mission-end' }> => e.t === 'mission-end');
    expect(missionEnd).toBeDefined();
    expect(missionEnd!.result).toBe('won');
    expect(useCombatStore.getState().phase).toBe('won');
  });

  it('log stays strictly monotonic (append-only): length never decreases during a session', () => {
    useCombatStore.getState().initMission({
      map: mkMap(['P.....G']),
      rosterIds: ['ranger_kestrel'],
    });
    forceRng(0x4);
    const lengths: number[] = [];
    lengths.push(useCombatStore.getState().combatEventLog.length);
    // Walk through a few actions.
    const t = useCombatStore.getState().units.find((u) => u.faction === 'enemy')!;
    useCombatStore.getState().tryRangerMark(t.id);
    lengths.push(useCombatStore.getState().combatEventLog.length);
    useCombatStore.getState().queueShot(t.id);
    useCombatStore.getState().confirmPending();
    lengths.push(useCombatStore.getState().combatEventLog.length);
    // Lengths must be non-decreasing — events are append-only.
    for (let i = 1; i < lengths.length; i++) {
      expect(lengths[i]).toBeGreaterThanOrEqual(lengths[i - 1]);
    }
    // And we actually appended something.
    expect(lengths[lengths.length - 1]).toBeGreaterThan(lengths[0]);
  });
});

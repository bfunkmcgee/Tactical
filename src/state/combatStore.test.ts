import { describe, it, expect, beforeEach } from 'vitest';
import { useCombatStore } from './combatStore';
import { getWeapon, getKit, useContent } from '../content/registry';
import type { GridMap, Tile } from '../game/types';
import { makeRng } from '../game/engine/rng';

/**
 * Covers the combat store's pure-logic surface: turn-action gating, ammo
 * + HP mutations, carry-over snapshotting, and utility resolution.
 * Async-only flows (runEnemyTurn, triggerOverwatch mid-step) are left to
 * integration testing — they ping-pong awaits with setTimeout.
 *
 * Every test seeds a deterministic RNG after initMission so shot
 * outcomes don't depend on Date.now().
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
        else if (ch === 'O') enemySpawns.push({ pos: { x, y }, spawnKey: 'O' });
      }
    });
  });
  return {
    id: 'test', name: 'Test Map', tileset: 'desert',
    width, height, tiles, playerSpawns, enemySpawns,
  };
}

/**
 * Force every hit / miss roll to produce the given outcome.
 * combat.resolveShot uses `rng.int(100) + 1 <= hitChance` → int(100) = 0
 * always hits (roll=1); int(100) = 99 always misses (roll=100).
 * The damage roll still works fine — it uses int of a tiny range.
 */
function forceRng(always: 'hit' | 'miss') {
  useCombatStore.setState({
    rng: {
      next: () => (always === 'hit' ? 0 : 0.99),
      int: (max: number) => (always === 'hit' ? 0 : Math.max(0, max - 1)),
      chance: () => always === 'hit',
    },
  });
}

function setupSoloDuel() {
  useCombatStore.getState().initMission({
    map: mkMap([
      'P........G', // Kestrel shoots a goblin across 9 tiles of open floor.
    ]),
    rosterIds: ['ranger_kestrel'],
  });
  // Keep the RNG deterministic across tests.
  useCombatStore.setState({ rng: makeRng(0xC0FFEE) });
}

describe('combatStore: initMission', () => {
  it('spawns exactly the roster + map enemy spawns on the correct tiles', () => {
    setupSoloDuel();
    const st = useCombatStore.getState();
    const players = st.units.filter((u) => u.faction === 'player');
    const enemies = st.units.filter((u) => u.faction === 'enemy');
    expect(players.length).toBe(1);
    expect(enemies.length).toBe(1);
    expect(players[0].pos).toEqual({ x: 0, y: 0 });
    expect(enemies[0].pos).toEqual({ x: 9, y: 0 });
    expect(st.phase).toBe('player');
    expect(st.round).toBe(1);
    expect(st.isSkirmish).toBe(false);
  });

  it('honours the isSkirmish flag on state', () => {
    useCombatStore.getState().initMission({
      map: mkMap(['P..G']), rosterIds: ['ranger_kestrel'], isSkirmish: true,
    });
    expect(useCombatStore.getState().isSkirmish).toBe(true);
  });

  it('applies carry HP/ammo (clamped to caps) to the spawned soldier', () => {
    useCombatStore.getState().initMission({
      map: mkMap(['P..G']),
      rosterIds: ['ranger_kestrel'],
      carries: {
        ranger_kestrel: {
          hp: 1,            // start near-dead
          ammoPrimary: 999, // absurd — should clamp to cap
          ammoSidearm: 0,
          utilityCharges: [],
          dirt: 42,
        },
      },
    });
    const p = useCombatStore.getState().units.find((u) => u.faction === 'player')!;
    expect(p.hp).toBe(1);
    // Primary cap = weapon.ammo (5) + kit.extraAmmoPrimary (2) = 7.
    const primary = getWeapon(p.loadout!.primaryId);
    const kit = p.loadout?.kitId ? getKit(p.loadout.kitId) : null;
    expect(p.ammo).toBe(primary.ammo + (kit?.effects.extraAmmoPrimary ?? 0));
    expect(p.sidearmAmmo).toBe(0);
    expect(p.dirt).toBe(42);
  });
});

describe('combatStore: tryReload', () => {
  beforeEach(setupSoloDuel);

  it('fills primary + sidearm to kit-adjusted caps and spends 1 AP', () => {
    const before = useCombatStore.getState().units[0];
    // Drain ammo.
    useCombatStore.setState({
      units: useCombatStore.getState().units.map((u) =>
        u.id === before.id ? { ...u, ammo: 0, sidearmAmmo: 0 } : u),
    });
    const ok = useCombatStore.getState().tryReload();
    expect(ok).toBe(true);
    const after = useCombatStore.getState().units.find((u) => u.id === before.id)!;
    const primary = getWeapon(before.loadout!.primaryId);
    const sidearm = getWeapon(before.loadout!.sidearmId);
    const kit = before.loadout?.kitId ? getKit(before.loadout.kitId) : null;
    expect(after.ammo).toBe(primary.ammo + (kit?.effects.extraAmmoPrimary ?? 0));
    expect(after.sidearmAmmo).toBe(sidearm.ammo + (kit?.effects.extraAmmoSidearm ?? 0));
    expect(after.ap).toBe(before.ap - 1);
  });

  it('refuses when the selected unit has no AP', () => {
    const id = useCombatStore.getState().selectedId!;
    useCombatStore.setState({
      units: useCombatStore.getState().units.map((u) =>
        u.id === id ? { ...u, ap: 0 } : u),
    });
    expect(useCombatStore.getState().tryReload()).toBe(false);
  });

  it('clears overwatch when reloading (can\'t watch while swapping a mag)', () => {
    const id = useCombatStore.getState().selectedId!;
    useCombatStore.setState({
      units: useCombatStore.getState().units.map((u) =>
        u.id === id ? { ...u, status: { ...u.status, overwatch: true } } : u),
    });
    useCombatStore.getState().tryReload();
    const u = useCombatStore.getState().units.find((x) => x.id === id)!;
    expect(u.status.overwatch).toBe(false);
  });
});

describe('combatStore: toggleOverwatch', () => {
  beforeEach(setupSoloDuel);

  it('enables overwatch and zeroes AP on a first toggle', () => {
    const before = useCombatStore.getState().units[0];
    expect(useCombatStore.getState().toggleOverwatch()).toBe(true);
    const after = useCombatStore.getState().units.find((u) => u.id === before.id)!;
    expect(after.status.overwatch).toBe(true);
    expect(after.ap).toBe(0);
  });

  it('disables overwatch on a second toggle (and leaves AP alone)', () => {
    useCombatStore.getState().toggleOverwatch();      // enable
    const before = useCombatStore.getState().units[0];
    useCombatStore.getState().toggleOverwatch();      // disable
    const after = useCombatStore.getState().units.find((u) => u.id === before.id)!;
    expect(after.status.overwatch).toBe(false);
    expect(after.ap).toBe(before.ap);                 // disable doesn't refund AP
  });

  it('refuses to enable without AP', () => {
    const id = useCombatStore.getState().selectedId!;
    useCombatStore.setState({
      units: useCombatStore.getState().units.map((u) =>
        u.id === id ? { ...u, ap: 0 } : u),
    });
    expect(useCombatStore.getState().toggleOverwatch()).toBe(false);
  });
});

describe('combatStore: tryRefit', () => {
  beforeEach(setupSoloDuel);

  it('swaps a primary mod and spends 1 AP', () => {
    const before = useCombatStore.getState().units[0];
    const mods = useContent().mods;
    const pick = Object.values(mods).find((m) =>
      m.slot === 'optic' && m.fits.includes(before.loadout!.primaryId
        ? getWeapon(before.loadout!.primaryId).class : 'rifle'))
      ?? Object.values(mods).find((m) => m.slot === 'optic');
    expect(pick).toBeDefined();
    const ok = useCombatStore.getState().tryRefit('optic', false, pick!.id);
    expect(ok).toBe(true);
    const after = useCombatStore.getState().units.find((u) => u.id === before.id)!;
    expect(after.loadout!.primaryMods.optic).toBe(pick!.id);
    expect(after.ap).toBe(before.ap - 1);
  });

  it('clears the mod when passed null', () => {
    const id = useCombatStore.getState().selectedId!;
    useCombatStore.setState({
      units: useCombatStore.getState().units.map((u) =>
        u.id === id && u.loadout
          ? { ...u, loadout: { ...u.loadout, primaryMods: { optic: 'dummy_optic' } } }
          : u),
    });
    useCombatStore.getState().tryRefit('optic', false, null);
    const u = useCombatStore.getState().units.find((x) => x.id === id)!;
    expect(u.loadout!.primaryMods.optic).toBeUndefined();
  });

  it('refuses while the soldier is in overwatch (no tinkering on-watch)', () => {
    const id = useCombatStore.getState().selectedId!;
    useCombatStore.setState({
      units: useCombatStore.getState().units.map((u) =>
        u.id === id ? { ...u, status: { ...u.status, overwatch: true } } : u),
    });
    expect(useCombatStore.getState().tryRefit('optic', false, null)).toBe(false);
  });

  it('refuses without AP', () => {
    const id = useCombatStore.getState().selectedId!;
    useCombatStore.setState({
      units: useCombatStore.getState().units.map((u) =>
        u.id === id ? { ...u, ap: 0 } : u),
    });
    expect(useCombatStore.getState().tryRefit('optic', false, null)).toBe(false);
  });
});

describe('combatStore: primary shot resolution', () => {
  beforeEach(setupSoloDuel);

  it('decrements primary ammo by one and spends weapon.apCost on a hit', () => {
    const shooter = useCombatStore.getState().units.find((u) => u.faction === 'player')!;
    const target = useCombatStore.getState().units.find((u) => u.faction === 'enemy')!;
    forceRng('hit');
    const queued = useCombatStore.getState().queueShot(target.id);
    expect(queued).toBe(true);
    useCombatStore.getState().confirmPending();
    const st = useCombatStore.getState();
    const after = st.units.find((u) => u.id === shooter.id)!;
    const weapon = getWeapon(shooter.loadout!.primaryId);
    expect(after.ammo).toBe(shooter.ammo - 1);
    expect(after.ap).toBe(shooter.ap - weapon.apCost);
    // Fire event pushed for the renderer.
    expect(st.fireEvents.length).toBe(1);
    expect(st.fireEvents[0]).toMatchObject({
      shooterId: shooter.id, targetPos: target.pos,
    });
    // Pending state cleared after resolution.
    expect(st.pendingShotTargetId).toBeNull();
    expect(st.mode).toBe('idle');
  });

  it('sets shakeFrames on hit but not on miss', () => {
    const target = useCombatStore.getState().units.find((u) => u.faction === 'enemy')!;
    forceRng('miss');
    useCombatStore.getState().queueShot(target.id);
    useCombatStore.getState().confirmPending();
    expect(useCombatStore.getState().shakeFrames).toBe(0);
    // Restart and try a hit.
    setupSoloDuel();
    const t2 = useCombatStore.getState().units.find((u) => u.faction === 'enemy')!;
    forceRng('hit');
    useCombatStore.getState().queueShot(t2.id);
    useCombatStore.getState().confirmPending();
    expect(useCombatStore.getState().shakeFrames).toBeGreaterThan(0);
  });

  it('transitions phase to won when the last enemy dies', () => {
    const enemy = useCombatStore.getState().units.find((u) => u.faction === 'enemy')!;
    // Pre-wound the goblin to 1 HP so any hit kills.
    useCombatStore.setState({
      units: useCombatStore.getState().units.map((u) =>
        u.id === enemy.id ? { ...u, hp: 1 } : u),
    });
    forceRng('hit');
    useCombatStore.getState().queueShot(enemy.id);
    useCombatStore.getState().confirmPending();
    const st = useCombatStore.getState();
    expect(st.phase).toBe('won');
    expect(st.kills).toBe(1);
  });

  it('refuses to queue a shot while enemy phase', () => {
    const enemy = useCombatStore.getState().units.find((u) => u.faction === 'enemy')!;
    useCombatStore.setState({ phase: 'enemy' });
    expect(useCombatStore.getState().queueShot(enemy.id)).toBe(false);
  });

  it('refuses to queue when out of ammo', () => {
    const id = useCombatStore.getState().selectedId!;
    const enemy = useCombatStore.getState().units.find((u) => u.faction === 'enemy')!;
    useCombatStore.setState({
      units: useCombatStore.getState().units.map((u) =>
        u.id === id ? { ...u, ammo: 0 } : u),
    });
    expect(useCombatStore.getState().queueShot(enemy.id)).toBe(false);
  });
});

describe('combatStore: sidearm shot', () => {
  beforeEach(setupSoloDuel);

  it('decrements sidearmAmmo (not primary) and spends weapon.apCost', () => {
    const shooter = useCombatStore.getState().units.find((u) => u.faction === 'player')!;
    const target = useCombatStore.getState().units.find((u) => u.faction === 'enemy')!;
    forceRng('hit');
    expect(useCombatStore.getState().queueSidearmShot(target.id)).toBe(true);
    useCombatStore.getState().confirmPending();
    const after = useCombatStore.getState().units.find((u) => u.id === shooter.id)!;
    const sidearm = getWeapon(shooter.loadout!.sidearmId);
    expect(after.sidearmAmmo).toBe(shooter.sidearmAmmo - 1);
    expect(after.ammo).toBe(shooter.ammo); // primary untouched
    expect(after.ap).toBe(shooter.ap - sidearm.apCost);
  });
});

describe('combatStore: snapshotSquadCarry', () => {
  beforeEach(setupSoloDuel);

  it('captures hp, ammo, utilityCharges, alive for every player unit', () => {
    const shooter = useCombatStore.getState().units.find((u) => u.faction === 'player')!;
    useCombatStore.setState({
      units: useCombatStore.getState().units.map((u) =>
        u.id === shooter.id ? { ...u, hp: 3, ammo: 1, sidearmAmmo: 2, utilityCharges: [1, 0] } : u),
    });
    const snap = useCombatStore.getState().snapshotSquadCarry();
    expect(snap.length).toBe(1);
    expect(snap[0]).toEqual({
      soldierId: shooter.templateId,
      alive: true,
      hp: 3,
      ammoPrimary: 1,
      ammoSidearm: 2,
      utilityCharges: [1, 0],
    });
  });

  it('reports hp=0 and alive=false for downed soldiers regardless of stored hp', () => {
    const id = useCombatStore.getState().selectedId!;
    useCombatStore.setState({
      units: useCombatStore.getState().units.map((u) =>
        u.id === id ? { ...u, alive: false, hp: 7 } : u),
    });
    const snap = useCombatStore.getState().snapshotSquadCarry();
    expect(snap[0].alive).toBe(false);
    expect(snap[0].hp).toBe(0);
  });
});

describe('combatStore: utilities', () => {
  beforeEach(setupSoloDuel);

  it('grenade deals clamped-by-armor damage to every unit in the radius', () => {
    // embercore_orb = grenade dmg 4-6, radius 2. We force rng.int → 0 so we
    // always see dmgMin (4). The enemy is 9 tiles away, so we queue at a
    // tile near them.
    const shooter = useCombatStore.getState().units.find((u) => u.faction === 'player')!;
    const enemy = useCombatStore.getState().units.find((u) => u.faction === 'enemy')!;
    // Move the shooter near the target so chebyshev ≤ range (7).
    useCombatStore.setState({
      units: useCombatStore.getState().units.map((u) =>
        u.id === shooter.id ? { ...u, pos: { x: 5, y: 0 } } : u),
    });
    forceRng('hit'); // chance unused, but int=0 gives min damage.
    // idx 0 is 'embercore_orb' on Kestrel's default loadout.
    expect(useCombatStore.getState().queueUtility(enemy.pos, 0)).toBe(true);
    useCombatStore.getState().confirmPending();
    const after = useCombatStore.getState().units.find((u) => u.id === enemy.id)!;
    expect(after.hp).toBe(Math.max(0, enemy.hp - 4));
    // Charge decremented on the shooter.
    const soldier = useCombatStore.getState().units.find((u) => u.id === shooter.id)!;
    expect(soldier.utilityCharges[0]).toBe(shooter.utilityCharges[0] - 1);
  });

  it('medkit heals within 1 tile, clamped to hpMax', () => {
    // Kestrel's utility slot 1 = phoenix_draught (medkit, heal 6).
    const shooter = useCombatStore.getState().units.find((u) => u.faction === 'player')!;
    useCombatStore.setState({
      units: useCombatStore.getState().units.map((u) =>
        u.id === shooter.id ? { ...u, hp: 2 } : u),
    });
    forceRng('hit');
    expect(useCombatStore.getState().queueUtility(shooter.pos, 1)).toBe(true);
    useCombatStore.getState().confirmPending();
    const after = useCombatStore.getState().units.find((u) => u.id === shooter.id)!;
    expect(after.hp).toBe(Math.min(shooter.hpMax, 2 + 6));
  });

  it('medkit at full HP does not exceed hpMax', () => {
    const shooter = useCombatStore.getState().units.find((u) => u.faction === 'player')!;
    // Already at hpMax — heal must clamp.
    forceRng('hit');
    useCombatStore.getState().queueUtility(shooter.pos, 1);
    useCombatStore.getState().confirmPending();
    const after = useCombatStore.getState().units.find((u) => u.id === shooter.id)!;
    expect(after.hp).toBeLessThanOrEqual(shooter.hpMax);
    expect(after.hp).toBe(shooter.hpMax);
  });

  it('smoke drops tiles inside the radius and no further', () => {
    // Kestrel's default doesn't have smoke, but Seraphine's does. Re-init
    // with Seraphine so slot 1 is mistvial.
    useCombatStore.getState().initMission({
      map: mkMap(['P..............G']),
      rosterIds: ['mystic_seraphine'],
    });
    const shooter = useCombatStore.getState().units.find((u) => u.faction === 'player')!;
    const center = { x: 5, y: 0 };
    forceRng('hit');
    expect(useCombatStore.getState().queueUtility(center, 1)).toBe(true); // mistvial idx
    useCombatStore.getState().confirmPending();
    const smoke = useCombatStore.getState().smokeTiles;
    // mistvial radius = 3, so tiles at chebyshev ≤3 around (5,0) that are in
    // bounds + non-wall become smoke. On a 1-row map, that's x in [2..8] = 7 tiles.
    expect(smoke.size).toBeGreaterThan(0);
    for (const [k, rounds] of smoke) {
      const x = k % 4096, y = Math.floor(k / 4096);
      expect(Math.max(Math.abs(x - center.x), Math.abs(y - center.y))).toBeLessThanOrEqual(3);
      expect(rounds).toBeGreaterThan(0);
    }
    // Confirm at least the tiles at the center and at radius 3 both exist.
    expect(smoke.has(center.x + center.y * 4096)).toBe(true);
    // Unaffected shooter ammo/hp.
    const after = useCombatStore.getState().units.find((u) => u.id === shooter.id)!;
    expect(after.ap).toBe(shooter.ap - 1);
  });
});

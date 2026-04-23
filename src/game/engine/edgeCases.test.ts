import { describe, it, expect } from 'vitest';
import { resolveWeapon } from './loadout';
import { resolveBlast } from './utilities';
import { makeRng } from './rng';
import type { GridMap, Tile, TileKind, Unit, Weapon, WeaponMod } from '../types';

/**
 * Combat engine edge-case coverage. Each test here pins behaviour that
 * existed before the test landed but wasn't previously covered — a
 * regression in any one would change observable game math, so they
 * catch silent drift when the engine code nearby is touched.
 *
 * Kept narrow + pure: no gameStore, no content registry. Synthetic
 * fixtures only, so a change to pack content can't break a test here.
 */

function mkMap(rows: string[]): GridMap {
  const width = rows[0].length, height = rows.length;
  const tiles: Tile[] = [];
  for (const r of rows) for (const ch of r) {
    const kind: TileKind =
      ch === '#' ? 'wall' : ch === 'H' ? 'cover_full' : ch === 'h' ? 'cover_half' : 'floor';
    tiles.push({ kind });
  }
  return { id: 't', name: 't', width, height, tiles, playerSpawns: [], enemySpawns: [] };
}

function mkUnit(partial: Partial<Unit> & { pos: Unit['pos']; id: number }): Unit {
  return {
    faction: 'enemy', templateId: 't', name: 'T',
    hp: 10, hpMax: 10, aim: 0, mobility: 4, ap: 2, apMax: 2, ammo: 0,
    sidearmAmmo: 0, utilityCharges: [],
    dmgMin: 0, dmgMax: 0, rangeShort: 0, rangeLong: 0,
    status: { overwatch: false, blinded: false, suppressed: false, marked: false, seeThroughSmoke: false },
    alive: true, color: '#fff',
    ...partial,
  } as Unit;
}

const MOD_BASE: Omit<WeaponMod, 'id' | 'name' | 'slot' | 'fits' | 'effects'> = {
  flavor: '', tag: 'mundane',
};
function mkMod(id: string, effects: WeaponMod['effects'], slot: WeaponMod['slot'] = 'muzzle'): WeaponMod {
  return { id, name: id, slot, fits: ['rifle'], effects, ...MOD_BASE };
}

const CARBINE: Weapon = {
  id: 'carbine', name: 'Carbine', flavor: '', class: 'rifle', slot: 'primary',
  dmgMin: 4, dmgMax: 6, aim: 0, crit: 10,
  rangeShort: 7, rangeLong: 14, ammo: 4, apCost: 1, tag: 'mundane',
};

// ---- resolveWeapon edges ----------------------------------------------

describe('resolveWeapon: flag + clamp edges', () => {
  it('deduplicates flags across mods that both contribute the same flag', () => {
    // Two mods each contributing `piercing` — resolved weapon should
    // have the flag exactly once (Set semantics). Pins behaviour at
    // loadout.ts:34 (`flags.add(f)` relies on Set dedup).
    const a = mkMod('a', { flags: ['piercing'] });
    const b = mkMod('b', { flags: ['piercing'] });
    const r = resolveWeapon(CARBINE, [a, b]);
    expect(r.flags.size).toBe(1);
    expect(r.flags.has('piercing')).toBe(true);
  });

  it('clamps ammo floor at 1 when a negative-ammo mod would take it below', () => {
    // Broken-content guard — loadout.ts:32 clamps `ammo` via Math.max(1, ...).
    // Synthetic mod with -99 ammo; resolved ammo = 1, not -95 or 0.
    const broken = mkMod('broken', { ammo: -99 });
    const r = resolveWeapon(CARBINE, [broken]);
    expect(r.effective.ammo).toBe(1);
  });

  it('keeps dmgMax >= dmgMin after mods push them in opposite directions', () => {
    // loadout.ts:29 enforces `dmgMax = Math.max(dmgMin, dmgMax + delta)`.
    // If a mod drops dmgMax below the modified dmgMin, the resolve
    // should pin them equal rather than inverting the min/max.
    const bumpMin = mkMod('bumpMin', { dmgMin: +3 });    // dmgMin 4 → 7
    const dropMax = mkMod('dropMax', { dmgMax: -5 });    // dmgMax 6 - 5 = 1, but clamped
    const r = resolveWeapon(CARBINE, [bumpMin, dropMax]);
    expect(r.effective.dmgMin).toBe(7);
    expect(r.effective.dmgMax).toBeGreaterThanOrEqual(r.effective.dmgMin);
  });

  it('clamps rangeLong at rangeShort when a long-range-reducing mod overshoots', () => {
    // loadout.ts:31 enforces rangeLong >= rangeShort.
    const reduce = mkMod('reduce', { rangeLong: -20 });
    const r = resolveWeapon(CARBINE, [reduce]);
    expect(r.effective.rangeLong).toBe(r.effective.rangeShort);
  });

  it('aim contribs match the number of mods that actually change aim', () => {
    // Mods that set aim = 0 should NOT emit a modifier row (the UI
    // treats the absence of a row as "no impact"). loadout.ts:23
    // gates on `if (m.effects.aim)` which is falsy for 0.
    const noAim = mkMod('noAim', { ammo: 2 });
    const plusAim = mkMod('plusAim', { aim: 5 }, 'optic');
    const r = resolveWeapon(CARBINE, [noAim, plusAim]);
    // CARBINE.aim = 0, so no base contrib; only one mod contributes.
    expect(r.aimContribs.length).toBe(1);
    expect(r.aimContribs[0].label).toBe('plusAim');
  });
});

// ---- resolveBlast edges -----------------------------------------------

describe('resolveBlast: radius + damage edges', () => {
  const rng = () => makeRng(42);

  function mkState(units: Unit[]): { units: Unit[]; map: GridMap } {
    return { units, map: mkMap(['.....', '.....', '.....', '.....', '.....']) };
  }

  it('radius 0 only damages the center tile, not neighbours', () => {
    // utilities.ts:92 uses `chebyshev(other.pos, center) <= radius`.
    // With radius 0 only the EXACT center tile is a victim.
    const a = mkUnit({ id: 1, pos: { x: 2, y: 2 } });
    const b = mkUnit({ id: 2, pos: { x: 3, y: 2 } });
    const state = mkState([a, b]) as any;
    const r = resolveBlast(
      state, { x: 2, y: 2 }, { dmgMin: 3, dmgMax: 3, radius: 0 },
      () => 0, rng(),
    );
    expect(r.damageByUnit.get(1)).toBeDefined();
    expect(r.damageByUnit.has(2)).toBe(false);
  });

  it('radius 1 is Chebyshev, not Euclidean — diagonal tiles land inside', () => {
    // chebyshev({x:2,y:2}, {x:3,y:3}) = max(|1|,|1|) = 1 → inside a
    // radius-1 blast. A Euclidean check would call it 1.414 (outside).
    const diagonal = mkUnit({ id: 1, pos: { x: 3, y: 3 } });
    const faraway = mkUnit({ id: 2, pos: { x: 4, y: 4 } });
    const state = mkState([diagonal, faraway]) as any;
    const r = resolveBlast(
      state, { x: 2, y: 2 }, { dmgMin: 3, dmgMax: 3, radius: 1 },
      () => 0, rng(),
    );
    expect(r.damageByUnit.has(1)).toBe(true);
    expect(r.damageByUnit.has(2)).toBe(false);
  });

  it('min 1 damage per victim even when armor DR exceeds rolled damage', () => {
    // utilities.ts:99 clamps damage at Math.max(1, rolled - dr).
    const tank = mkUnit({ id: 1, pos: { x: 2, y: 2 }, hp: 20, hpMax: 20 });
    const state = mkState([tank]) as any;
    const r = resolveBlast(
      state, { x: 2, y: 2 }, { dmgMin: 2, dmgMax: 2, radius: 1 },
      () => 99, rng(),
    );
    expect(r.damageByUnit.get(1)).toBe(1);
    const updated = r.units.find((u) => u.id === 1)!;
    expect(updated.hp).toBe(19);
    expect(updated.alive).toBe(true);
  });

  it('skips dead units entirely — no double-kill, no phantom damage', () => {
    // A unit with alive=false is filtered at utilities.ts:91 before
    // the victim list is built, so resolveBlast leaves it untouched.
    const corpse = mkUnit({ id: 1, pos: { x: 2, y: 2 }, hp: 0, alive: false });
    const state = mkState([corpse]) as any;
    const r = resolveBlast(
      state, { x: 2, y: 2 }, { dmgMin: 5, dmgMax: 5, radius: 2 },
      () => 0, rng(),
    );
    expect(r.damageByUnit.has(1)).toBe(false);
    expect(r.kills).toBe(0);
    const same = r.units.find((u) => u.id === 1)!;
    expect(same.alive).toBe(false);
    expect(same.hp).toBe(0);
  });

  it('counts kills only for enemy faction (player blast on a player ally does not count)', () => {
    // utilities.ts:102 `if (died && o.faction === 'enemy') kills += 1`.
    // Friendly-fire deaths are tracked via damageByUnit but not kills.
    const ally = mkUnit({ id: 1, faction: 'player', pos: { x: 2, y: 2 }, hp: 2, hpMax: 10 });
    const foe = mkUnit({ id: 2, faction: 'enemy', pos: { x: 2, y: 2 }, hp: 2, hpMax: 10 });
    const state = mkState([ally, foe]) as any;
    const r = resolveBlast(
      state, { x: 2, y: 2 }, { dmgMin: 5, dmgMax: 5, radius: 1 },
      () => 0, rng(),
    );
    expect(r.kills).toBe(1); // only the enemy counts
    const deadAlly = r.units.find((u) => u.id === 1)!;
    const deadFoe = r.units.find((u) => u.id === 2)!;
    expect(deadAlly.alive).toBe(false); // friendly fire still kills
    expect(deadFoe.alive).toBe(false);
  });
});

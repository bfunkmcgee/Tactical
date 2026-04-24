import { describe, it, expect } from 'vitest';
import { resolveWeapon } from './loadout';
import { resolveBlast } from './utilities';
import { previewShot, resolveShot } from './combat';
import { getCoverState } from './los';
import { makeRng } from './rng';
import { deriveSoldierStats } from './stats';
import { unitArmor } from '../../state/combatStore';
import type { GridMap, Tile, TileKind, Unit, Weapon, WeaponMod, Armor, ShotPreview } from '../types';

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

  it('unitArmor returns 0 for units without a loadout — EngineDeps invariant', () => {
    // Phase-C cross-cut: engine modules pass any unit to `deps.armorOf`
    // without a faction wrapper because the store's `unitArmor`
    // guarantees 0 for loadout-less units. If future code attaches a
    // loadout to an enemy, or changes unitArmor semantics, this test
    // forces the faction-gating wrappers that were removed back onto
    // the audit table. See src/game/engine/deps.ts.
    const enemy = mkUnit({ id: 1, faction: 'enemy', pos: { x: 0, y: 0 } });
    expect(enemy.loadout).toBeUndefined();
    expect(unitArmor(enemy)).toBe(0);
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

// ---- resolveShot burst + crit + piercing edges ----------------------

describe('resolveShot: burst + crit + piercing composition', () => {
  // A narrow-band burst weapon: 3 rounds, per-round damage fixed at 4
  // (dmgMin=dmgMax=12, divided by 3 = 4 per round). Keeps the math
  // predictable so we can assert exact totals.
  const BURST_RIFLE: Weapon = {
    id: 'burst', name: 'Burst', flavor: '', class: 'rifle', slot: 'primary',
    dmgMin: 12, dmgMax: 12, aim: 0, crit: 10,
    rangeShort: 7, rangeLong: 14, ammo: 9, apCost: 1, tag: 'mundane',
    burstShots: 3,
  };

  function mkPreview(overrides: Partial<ShotPreview> = {}): ShotPreview {
    return {
      hitChance: 100, critChance: 0, cover: 'none',
      dmgMin: 0, dmgMax: 0, inRange: true, hasLOS: true, modifiers: [],
      ...overrides,
    };
  }

  it('piercing flag reduces DR by 2 per round on every burst round', () => {
    // DR 3 with piercing → effectiveDr = max(0, 3 - 2) = 1. Per-round
    // damage = 4 - 1 = 3. Three hits → total 9.
    const armor: Armor = {
      id: 'a', name: '', flavor: '', slot: 'chest',
      hpBonus: 0, dr: 3, mobility: 0, tag: 'mundane',
    };
    const piercing: WeaponMod = {
      id: 'p', name: 'p', flavor: '', slot: 'magazine', fits: ['rifle'],
      effects: { flags: ['piercing'] }, tag: 'mundane',
    };
    const r = resolveShot(mkPreview({ hitChance: 100 }), BURST_RIFLE, armor, makeRng(7), [piercing]);
    expect(r.kind).toBe('hit');
    if (r.kind !== 'hit') return;
    expect(r.hits).toBe(3);
    expect(r.burstRounds).toBe(3);
    expect(r.damage).toBe(9); // (4 - 1) * 3 rounds
  });

  it('per-round min 1 damage clamp holds when DR exceeds per-round max', () => {
    // DR 99 vs per-round damage 4 → every round clamps to 1, total = 3.
    // Pins the `Math.max(1, raw - effectiveDr)` guard at combat.ts:132.
    const armor: Armor = {
      id: 'a', name: '', flavor: '', slot: 'chest',
      hpBonus: 0, dr: 99, mobility: 0, tag: 'mundane',
    };
    const r = resolveShot(mkPreview({ hitChance: 100 }), BURST_RIFLE, armor, makeRng(7));
    expect(r.kind).toBe('hit');
    if (r.kind !== 'hit') return;
    expect(r.hits).toBe(3);
    expect(r.damage).toBe(3); // 1 + 1 + 1
  });

  it('burst `anyCrit` flag is true iff AT LEAST ONE round critted', () => {
    // Force guaranteed crits: hitChance 100 + critChance 100 → every
    // round's crit roll <= 100 succeeds, so anyCrit must flip true.
    // Pins the `if (critical) anyCrit = true;` branch.
    const r = resolveShot(
      mkPreview({ hitChance: 100, critChance: 100 }),
      BURST_RIFLE, null, makeRng(13),
    );
    expect(r.kind).toBe('hit');
    if (r.kind !== 'hit') return;
    expect(r.critical).toBe(true);
    // 3 crit rounds × round(4 * 1.5) = 6 per round = 18 total.
    expect(r.damage).toBe(18);
  });

  it('burst miss returns miss kind + carries burstRounds for HUD ("0/3 rounds hit")', () => {
    // hitChance 0 → every roll fails. Pins the
    // `burstShots > 1 ? { miss + burstRounds } : { miss }` branch.
    const r = resolveShot(
      mkPreview({ hitChance: 0 }),
      BURST_RIFLE, null, makeRng(17),
    );
    expect(r.kind).toBe('miss');
    if (r.kind !== 'miss') return;
    expect(r.burstRounds).toBe(3);
  });
});

// ---- previewShot cover + piercing composition ----------------------

describe('previewShot: cover arithmetic + piercing DR', () => {
  function mkMap2(rows: string[]): GridMap {
    const width = rows[0].length, height = rows.length;
    const tiles: Tile[] = [];
    for (const r of rows) for (const ch of r) {
      const kind: TileKind =
        ch === '#' ? 'wall' : ch === 'H' ? 'cover_full' : ch === 'h' ? 'cover_half' : 'floor';
      tiles.push({ kind });
    }
    return { id: 't', name: 't', width, height, tiles, playerSpawns: [], enemySpawns: [] };
  }

  const RIFLE: Weapon = {
    id: 'rifle', name: 'Rifle', flavor: '', class: 'rifle', slot: 'primary',
    dmgMin: 4, dmgMax: 6, aim: 0, crit: 10,
    rangeShort: 7, rangeLong: 14, ammo: 4, apCost: 1, tag: 'mundane',
  };

  it('diagonal shot: cover tile axis-adjacent to the target (on x-side) supplies full cover', () => {
    // getCoverState (los.ts:49-64) evaluates target.x+dx AND target.y+dy
    // for the shooter-direction signs, so a diagonal shot reads cover
    // from EITHER axis-neighbour. Shooter at (0,0), target at (4,4):
    // dx = sign(0-4) = -1 → candidate (3, 4). Placing cover at (3, 4)
    // must resolve to 'full'.
    const m = mkMap2([
      '......',
      '......',
      '......',
      '......',
      '...HT.',   // target at (4, 4); cover_full at (3, 4) → x-side adj
      '......',
    ]);
    const state = getCoverState(m, { x: 0, y: 0 }, { x: 4, y: 4 });
    expect(state).toBe('full');
  });

  it('diagonal shot: cover_full on one axis + cover_half on the other resolves `full` (best wins)', () => {
    // Target at (4, 4) with half cover on x-side (3, 4) and full cover
    // on y-side (4, 3). Shooter at (0, 0). Best-of wins: 'full'.
    const m = mkMap2([
      '......',
      '......',
      '......',
      '....H.',   // cover_full at (4, 3) → y-side adj
      '...hT.',   // cover_half at (3, 4) → x-side adj; target at (4, 4)
      '......',
    ]);
    const state = getCoverState(m, { x: 0, y: 0 }, { x: 4, y: 4 });
    expect(state).toBe('full');
  });

  it('piercing flag shows up in dmg{Min,Max} and cover penalty still appears in hitChance modifiers', () => {
    // Independence test: piercing touches damage math, cover touches
    // hit-chance math. Both apply together without interference.
    // Shooter at (5, 1), target at (2, 1). dx = sign(5-2) = 1, dy = 0.
    // Candidate = (3, 1). Place cover_full at (3, 1).
    const m2 = mkMap2([
      '......',   // row 0
      '..TH.S',   // row 1: target(2,1), cover(3,1), shooter(5,1)
      '......',   // row 2
    ]);
    const shooter = {
      id: 1, faction: 'player', templateId: 't', name: 'S',
      pos: { x: 5, y: 1 },
      hp: 10, hpMax: 10, aim: 0, mobility: 4, ap: 2, apMax: 2, ammo: 4,
      sidearmAmmo: 0, utilityCharges: [],
      dmgMin: 0, dmgMax: 0, rangeShort: 0, rangeLong: 0,
      status: { overwatch: false, blinded: false, suppressed: false, marked: false, seeThroughSmoke: false },
      alive: true, color: '#fff',
    } as Unit;
    const target = { ...shooter, id: 2, faction: 'enemy', pos: { x: 2, y: 1 }, name: 'T' } as Unit;

    const piercing: WeaponMod = {
      id: 'p', name: 'p', flavor: '', slot: 'magazine', fits: ['rifle'],
      effects: { flags: ['piercing'] }, tag: 'mundane',
    };
    const p = previewShot(m2, shooter, target, RIFLE, /* targetArmorDr */ 3, undefined, [piercing]);

    expect(p.cover).toBe('full');
    expect(p.modifiers.some((x) => x.label.includes('cover'))).toBe(true);
    // Piercing drops effective DR from 3 → 1, so dmgMin = 4-1 = 3.
    expect(p.dmgMin).toBe(3);
    expect(p.dmgMax).toBe(5);
  });
});

// ---- deriveSoldierStats clamps (mkSoldierUnit spawn-time math) ------

describe('deriveSoldierStats: hpMax + mobility clamps', () => {
  const EMPTY_KIT: SoldierStatsInput['kitEffects'] = {};

  // Shared builder — keeps the tests short.
  type SoldierStatsInput = Parameters<typeof deriveSoldierStats>[0];
  function mk(partial: Partial<SoldierStatsInput>): SoldierStatsInput {
    return {
      baseHp: 10, baseMobility: 4, baseAim: 0,
      primaryAmmoBase: 4, sidearmAmmoBase: 2,
      armorHpBonus: 0, armorMobility: 0,
      kitEffects: EMPTY_KIT, modMobility: 0,
      ...partial,
    };
  }

  it('hpMax clamps to a minimum of 1 no matter how negative the stack goes', () => {
    // baseHp 2 + armor -5 + kit -4 = -7 → clamped to 1.
    const s = deriveSoldierStats(mk({
      baseHp: 2, armorHpBonus: -5, kitEffects: { hpBonus: -4 },
    }));
    expect(s.hpMax).toBe(1);
  });

  it('mobility clamps to a minimum of 2 (the soldier can always walk 2 tiles)', () => {
    // baseMobility 3 + armor -2 + kit -2 + mods -1 = -2 → clamped to 2.
    const s = deriveSoldierStats(mk({
      baseMobility: 3, armorMobility: -2,
      kitEffects: { mobilityBonus: -2 }, modMobility: -1,
    }));
    expect(s.mobility).toBe(2);
  });

  it('positive stacks sum normally without any cap on the upper end', () => {
    // hpMax: 10 + 3 (armor) + 2 (kit) = 15; mobility: 4 + 1 + 2 + 1 = 8.
    const s = deriveSoldierStats(mk({
      baseHp: 10, armorHpBonus: 3,
      baseMobility: 4, armorMobility: 1,
      kitEffects: { hpBonus: 2, mobilityBonus: 2 }, modMobility: 1,
    }));
    expect(s.hpMax).toBe(15);
    expect(s.mobility).toBe(8);
  });

  it('ammo caps sum without clamping — pack content guarantees non-negative', () => {
    // The ammo bumps in kit effects add directly to the weapon's cap.
    // No Math.max wrap here — if a future mod introduces negative ammo
    // effects, they would produce sub-zero caps (visible via this test).
    const s = deriveSoldierStats(mk({
      primaryAmmoBase: 4, sidearmAmmoBase: 2,
      kitEffects: { extraAmmoPrimary: 3, extraAmmoSidearm: 1 },
    }));
    expect(s.ammoPrimaryMax).toBe(7);
    expect(s.ammoSidearmMax).toBe(3);
  });

  it('aim adds the kit aim bonus without clamping — any sign survives', () => {
    const s = deriveSoldierStats(mk({
      baseAim: 15, kitEffects: { aimBonus: -5 },
    }));
    expect(s.aim).toBe(10);
  });
});

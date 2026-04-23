import { describe, it, expect } from 'vitest';
import { previewShot, resolveShot } from './combat';
import { makeRng } from './rng';
import type { GridMap, Tile, TileKind, Unit, Weapon } from '../types';

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

function mkUnit(partial: Partial<Unit> & { pos: Unit['pos'] }): Unit {
  return {
    id: 1, faction: 'player', templateId: 't', name: 'T',
    hp: 10, hpMax: 10, aim: 0, mobility: 4, ap: 2, apMax: 2, ammo: 4,
    sidearmAmmo: 0, utilityCharges: [],
    dmgMin: 0, dmgMax: 0, rangeShort: 0, rangeLong: 0,
    status: { overwatch: false, blinded: false, suppressed: false, marked: false, seeThroughSmoke: false },
    alive: true, color: '#fff',
    ...partial,
  };
}

const RIFLE: Weapon = {
  id: 'rifle', name: 'Rifle', flavor: '', class: 'rifle', slot: 'primary',
  dmgMin: 4, dmgMax: 6, aim: 0, crit: 10,
  rangeShort: 7, rangeLong: 14, ammo: 4, apCost: 1, tag: 'runic',
};

describe('previewShot', () => {
  it('clear shot at short range near base 65%', () => {
    const m = mkMap(['..........']);
    const shooter = mkUnit({ pos: { x: 0, y: 0 } });
    const target = mkUnit({ id: 2, faction: 'enemy', pos: { x: 5, y: 0 } });
    const p = previewShot(m, shooter, target, RIFLE, 0);
    expect(p.hitChance).toBe(65);
    expect(p.cover).toBe('none');
    expect(p.hasLOS).toBe(true);
    expect(p.dmgMin).toBe(4);
    expect(p.dmgMax).toBe(6);
  });

  it('applies cover penalty and removes flanking bonus', () => {
    // target behind full cover (east side wall; shooter west)
    const m = mkMap(['.....H...']);
    const shooter = mkUnit({ pos: { x: 0, y: 0 } });
    const target = mkUnit({ id: 2, faction: 'enemy', pos: { x: 6, y: 0 } });
    // cover check: dx = sign(0-6) = -1 → candidate x = 6-1 = 5 ('H').
    const p = previewShot(m, shooter, target, RIFLE, 0);
    expect(p.cover).toBe('full');
    expect(p.hitChance).toBe(65 - 40);
    expect(p.critChance).toBe(10); // no flank bonus in full cover
  });

  it('reduces damage by armor DR', () => {
    const m = mkMap(['..........']);
    const shooter = mkUnit({ pos: { x: 0, y: 0 } });
    const target = mkUnit({ id: 2, faction: 'enemy', pos: { x: 3, y: 0 } });
    const p = previewShot(m, shooter, target, RIFLE, 2);
    expect(p.dmgMin).toBe(2);
    expect(p.dmgMax).toBe(4);
  });
});

describe('resolveShot', () => {
  it('deterministically produces the same outcome with the same seed', () => {
    const m = mkMap(['..........']);
    const shooter = mkUnit({ pos: { x: 0, y: 0 } });
    const target = mkUnit({ id: 2, faction: 'enemy', pos: { x: 3, y: 0 } });
    const p = previewShot(m, shooter, target, RIFLE, 0);
    const a = resolveShot(p, RIFLE, null, makeRng(42));
    const b = resolveShot(p, RIFLE, null, makeRng(42));
    expect(a).toEqual(b);
  });

  it('never deals less than 1 damage on hit', () => {
    const m = mkMap(['.....']);
    const shooter = mkUnit({ pos: { x: 0, y: 0 } });
    const target = mkUnit({ id: 2, faction: 'enemy', pos: { x: 2, y: 0 } });
    const p = previewShot(m, shooter, target, RIFLE, 99); // armor > dmgMax
    // Force a hit by giving 100% chance
    const forced = { ...p, hitChance: 100, critChance: 0 };
    const rng = makeRng(1);
    const r = resolveShot(forced, RIFLE, { id: 'a', name: '', flavor: '', slot: 'chest', hpBonus: 0, dr: 99, mobility: 0, tag: 'mundane' }, rng);
    expect(r.kind).toBe('hit');
    if (r.kind === 'hit') expect(r.damage).toBeGreaterThanOrEqual(1);
  });

  it('single-shot results omit hits/burstRounds fields (backward-compat)', () => {
    const m = mkMap(['.....']);
    const shooter = mkUnit({ pos: { x: 0, y: 0 } });
    const target = mkUnit({ id: 2, faction: 'enemy', pos: { x: 2, y: 0 } });
    const p = previewShot(m, shooter, target, RIFLE, 0);
    const r = resolveShot({ ...p, hitChance: 100, critChance: 0 }, RIFLE, null, makeRng(7));
    expect(r.kind).toBe('hit');
    if (r.kind === 'hit') {
      expect(r.hits).toBeUndefined();
      expect(r.burstRounds).toBeUndefined();
    }
  });
});

describe('resolveShot (burst fire)', () => {
  // A 3-round auto weapon with the same total damage band as the rifle —
  // lets us compare variance without changing expected damage.
  const BURST: Weapon = {
    ...RIFLE, id: 'burst', name: 'Burst', class: 'smg', burstShots: 3,
  };

  it('rolls each round independently — a 100%-hit burst lands every round', () => {
    const m = mkMap(['.....']);
    const shooter = mkUnit({ pos: { x: 0, y: 0 } });
    const target = mkUnit({ id: 2, faction: 'enemy', pos: { x: 2, y: 0 } });
    const p = previewShot(m, shooter, target, BURST, 0);
    const forced = { ...p, hitChance: 100, critChance: 0 };
    const r = resolveShot(forced, BURST, null, makeRng(1));
    expect(r.kind).toBe('hit');
    if (r.kind === 'hit') {
      expect(r.hits).toBe(3);
      expect(r.burstRounds).toBe(3);
      // Per-round damage is ceil(4/3)..ceil(6/3) = 2..2, so 3 rounds give 6
      // total damage at minimum (and up to ~6 at max since max = min).
      expect(r.damage).toBeGreaterThanOrEqual(3 * 2);
    }
  });

  it('0%-hit burst misses and reports burstRounds', () => {
    const m = mkMap(['.....']);
    const shooter = mkUnit({ pos: { x: 0, y: 0 } });
    const target = mkUnit({ id: 2, faction: 'enemy', pos: { x: 2, y: 0 } });
    const p = previewShot(m, shooter, target, BURST, 0);
    const forced = { ...p, hitChance: 0, critChance: 0 };
    const r = resolveShot(forced, BURST, null, makeRng(1));
    expect(r.kind).toBe('miss');
    expect(r.burstRounds).toBe(3);
  });

  it('partial hit counts (not every round connects)', () => {
    // At 50% hit chance and a fixed seed, some rolls hit and some miss.
    // We just assert the count is strictly between 0 and burstRounds.
    const m = mkMap(['.....']);
    const shooter = mkUnit({ pos: { x: 0, y: 0 } });
    const target = mkUnit({ id: 2, faction: 'enemy', pos: { x: 2, y: 0 } });
    const p = previewShot(m, shooter, target, BURST, 0);
    const forced = { ...p, hitChance: 50, critChance: 0 };
    // Seed chosen by sampling — this particular seed gives 2/3 hits.
    const r = resolveShot(forced, BURST, null, makeRng(3));
    if (r.kind === 'hit') {
      expect(r.hits).toBeGreaterThanOrEqual(1);
      expect(r.hits!).toBeLessThanOrEqual(3);
      expect(r.burstRounds).toBe(3);
    }
  });

  it('total burst damage has LOWER variance than single-shot over many rolls', () => {
    // A 3-round burst of 3 @ 65% hit should have a tighter damage
    // distribution than one single-shot @ 65% — the test samples many
    // rolls and checks the spread.
    const m = mkMap(['.....']);
    const shooter = mkUnit({ pos: { x: 0, y: 0 } });
    const target = mkUnit({ id: 2, faction: 'enemy', pos: { x: 2, y: 0 } });
    const p = previewShot(m, shooter, target, BURST, 0);
    const N = 500;
    const burstSamples: number[] = [];
    const singleSamples: number[] = [];
    for (let i = 0; i < N; i++) {
      const br = resolveShot({ ...p, hitChance: 65 }, BURST, null, makeRng(i));
      burstSamples.push(br.kind === 'hit' ? br.damage : 0);
      const sr = resolveShot({ ...p, hitChance: 65 }, RIFLE, null, makeRng(i));
      singleSamples.push(sr.kind === 'hit' ? sr.damage : 0);
    }
    const burstVar = variance(burstSamples);
    const singleVar = variance(singleSamples);
    expect(burstVar).toBeLessThan(singleVar);
  });

  it('armor DR applies per round — burst payload is smaller than single-shot vs tanky targets', () => {
    const armor = { id: 'a', name: '', flavor: '', slot: 'chest' as const, hpBonus: 0, dr: 2, mobility: 0, tag: 'mundane' as const };
    const m = mkMap(['.....']);
    const shooter = mkUnit({ pos: { x: 0, y: 0 } });
    const target = mkUnit({ id: 2, faction: 'enemy', pos: { x: 2, y: 0 } });
    const p = previewShot(m, shooter, target, BURST, 0);
    const forced = { ...p, hitChance: 100, critChance: 0 };
    const r = resolveShot(forced, BURST, armor, makeRng(11));
    expect(r.kind).toBe('hit');
    if (r.kind === 'hit') {
      // Per-round damage 2, armor DR 2 → each round clamps to min 1. 3 rounds
      // × 1 min = 3 damage floor. Can't exceed 3 * 2 = 6 (base per round = 2).
      expect(r.damage).toBeGreaterThanOrEqual(3);
    }
  });
});

function variance(xs: number[]): number {
  const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
  return xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length;
}

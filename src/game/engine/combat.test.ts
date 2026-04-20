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
    status: { overwatch: false, blinded: false, suppressed: false },
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
    const r = resolveShot(forced, RIFLE, { id: 'a', name: '', flavor: '', hpBonus: 0, dr: 99, mobility: 0, tag: 'mundane' }, rng);
    expect(r.kind).toBe('hit');
    if (r.kind === 'hit') expect(r.damage).toBeGreaterThanOrEqual(1);
  });
});

import { describe, it, expect } from 'vitest';
import { groupActions, pickOverflow, MAX_VISIBLE_ACTIONS } from './groupActions';
import type { Unit } from '../../game/types';
import type { ContentPack } from '../../content/types';

/**
 * Pure-data tests for the action-bar grouping helper. No React, no Pixi —
 * just the descriptor shapes. Stub Units + a minimal ContentPack so the
 * tests stay independent of pack content drift.
 */

function mkUnit(over: Partial<Unit> = {}): Unit {
  return {
    id: 1, faction: 'player', templateId: 'ranger',
    name: 'Test', pos: { x: 0, y: 0 },
    hp: 10, hpMax: 10, aim: 50, mobility: 4,
    ap: 2, apMax: 2,
    ammo: 7, sidearmAmmo: 5, utilityCharges: [],
    dmgMin: 0, dmgMax: 0, rangeShort: 0, rangeLong: 0,
    status: { overwatch: false, blinded: false, suppressed: false, marked: false, seeThroughSmoke: false },
    alive: true, color: '#ffffff',
    ...over,
  };
}

function mkPack(): ContentPack {
  // Minimal stub — only the fields groupActions reads.
  return {
    id: 'test', name: 'Test', description: '',
    soldierTemplates: {
      ranger: { id: 'ranger', name: 'Ranger', class: 'Ranger', portraitColor: '#fff', hpMax: 10, aim: 0, mobility: 4 } as never,
      mystic: { id: 'mystic', name: 'Mystic', class: 'Mystic', portraitColor: '#fff', hpMax: 10, aim: 0, mobility: 4 } as never,
      warden: { id: 'warden', name: 'Warden', class: 'Warden', portraitColor: '#fff', hpMax: 10, aim: 0, mobility: 4 } as never,
    },
    defaultRoster: [],
    enemyTemplates: {},
    weapons: {
      runeweave_carbine: { id: 'runeweave_carbine', name: 'Carbine', class: 'rifle', slot: 'primary', dmgMin: 3, dmgMax: 5, rangeShort: 5, rangeLong: 10, ammo: 7, apCost: 1 } as never,
      sigilshot_pistol: { id: 'sigilshot_pistol', name: 'Pistol', class: 'pistol', slot: 'sidearm', dmgMin: 2, dmgMax: 3, rangeShort: 4, rangeLong: 8, ammo: 5, apCost: 1 } as never,
    },
    armor: {},
    utilities: {
      embercore_orb: { id: 'embercore_orb', name: 'Embercore Orb', kind: 'frag', radius: 2, range: 6, dmgMin: 3, dmgMax: 5, apCost: 1 } as never,
      phoenix_draught: { id: 'phoenix_draught', name: 'Phoenix Draught', kind: 'heal', radius: 1, range: 1, heal: 5, apCost: 1 } as never,
      smoke_grenade: { id: 'smoke_grenade', name: 'Smoke Grenade', kind: 'smoke', radius: 2, range: 6, apCost: 1 } as never,
    },
    kits: {},
    mods: {},
    abilities: {},
    spawnLegend: {},
    playerFaction: { id: 'p', name: 'P', sigilColor: '#fff' },
    enemyFaction:  { id: 'e', name: 'E', sigilColor: '#fff' },
  };
}

describe('groupActions: per-unit action descriptor groups', () => {
  it('1. pistol-only soldier: Fire disabled, Sidearm carries weapon name, utilities empty', () => {
    const pack = mkPack();
    const unit = mkUnit({
      loadout: {
        primaryId: '__missing__', // resolves to null in pack.weapons
        primaryMods: {}, sidearmId: 'sigilshot_pistol', sidearmMods: {},
        utilityIds: [], armor: {}, kitId: null,
      } as never,
      ammo: 0, // primary missing → no ammo
    });
    const groups = groupActions({
      unit, mode: 'idle', selectedUtilityIdx: null, phase: 'player', content: pack,
    });
    expect(groups.primary.map((d) => d.id)).toEqual(['move', 'fire', 'sidearm']);
    expect(groups.primary.find((d) => d.id === 'fire')!.disabled).toBe(true);
    expect(groups.primary.find((d) => d.id === 'sidearm')!.label).toBe('Sidearm · Pistol 5/5');
    expect(groups.utilities).toEqual([]);
  });

  it('2. full Ranger loadout (2 utilities, AP 2): all four groups, Fire label includes weapon, class has Mark + Refit', () => {
    const pack = mkPack();
    const unit = mkUnit({
      templateId: 'ranger',
      loadout: {
        primaryId: 'runeweave_carbine', primaryMods: {},
        sidearmId: 'sigilshot_pistol', sidearmMods: {},
        utilityIds: ['embercore_orb', 'phoenix_draught'],
        armor: {}, kitId: null,
      } as never,
      utilityCharges: [2, 2],
    });
    const groups = groupActions({
      unit, mode: 'idle', selectedUtilityIdx: null, phase: 'player', content: pack,
    });
    expect(groups.primary.find((d) => d.id === 'fire')!.label).toBe('Fire · Carbine 7/7');
    expect(groups.primary.find((d) => d.id === 'fire')!.shortLabel).toBe('Fire 7/7');
    expect(groups.utilities.map((d) => d.id)).toEqual(['utility-0', 'utility-1']);
    expect(groups.utilities[0].label).toBe('Embercore Orb ×2');
    expect(groups.class.map((d) => d.label)).toEqual(['Mark', 'Refit']);
    expect(groups.system.map((d) => d.id)).toEqual(['reload', 'overwatch', 'endTurn']);
  });

  it('3. low-AP soldier (AP 0): Move/Fire/Refit disabled, End Turn still enabled', () => {
    const pack = mkPack();
    const unit = mkUnit({
      templateId: 'ranger', ap: 0,
      loadout: {
        primaryId: 'runeweave_carbine', primaryMods: {},
        sidearmId: 'sigilshot_pistol', sidearmMods: {},
        utilityIds: [], armor: {}, kitId: null,
      } as never,
    });
    const groups = groupActions({
      unit, mode: 'idle', selectedUtilityIdx: null, phase: 'player', content: pack,
    });
    expect(groups.primary.find((d) => d.id === 'move')!.disabled).toBe(true);
    expect(groups.primary.find((d) => d.id === 'fire')!.disabled).toBe(true);
    expect(groups.class.find((d) => d.id === 'refit')!.disabled).toBe(true);
    // Reload at full magazines is also disabled.
    expect(groups.system.find((d) => d.id === 'reload')!.disabled).toBe(true);
    // End Turn must remain enabled even at AP 0 — players need to hand the turn over.
    expect(groups.system.find((d) => d.id === 'endTurn')!.disabled).toBe(false);
  });

  it('4. overflow trigger: 3 utilities + class ability + Refit > 8 visible; pickOverflow trims tail of class', () => {
    const pack = mkPack();
    const unit = mkUnit({
      templateId: 'ranger',
      loadout: {
        primaryId: 'runeweave_carbine', primaryMods: {},
        sidearmId: 'sigilshot_pistol', sidearmMods: {},
        utilityIds: ['embercore_orb', 'phoenix_draught', 'smoke_grenade'],
        armor: {}, kitId: null,
      } as never,
      utilityCharges: [1, 1, 1],
    });
    const groups = groupActions({
      unit, mode: 'idle', selectedUtilityIdx: null, phase: 'player', content: pack,
    });
    // 3 + 3 + 2 + 3 = 11 total
    const total = groups.primary.length + groups.utilities.length + groups.class.length + groups.system.length;
    expect(total).toBeGreaterThan(MAX_VISIBLE_ACTIONS);
    const { visible, overflow } = pickOverflow(groups);
    // class group keeps at least its first slot (the actual class ability)
    expect(visible.class.length).toBeGreaterThanOrEqual(1);
    expect(visible.class[0].label).toBe('Mark');
    // Overflow contains Refit (the predictable non-essential entry)
    expect(overflow.map((d) => d.label)).toContain('Refit');
  });

  it('5. Mystic with active Sight: class label flips to "Sight Active" and disabled', () => {
    const pack = mkPack();
    const unit = mkUnit({
      templateId: 'mystic',
      status: { overwatch: false, blinded: false, suppressed: false, marked: false, seeThroughSmoke: true },
      loadout: {
        primaryId: 'runeweave_carbine', primaryMods: {},
        sidearmId: 'sigilshot_pistol', sidearmMods: {},
        utilityIds: [], armor: {}, kitId: null,
      } as never,
    });
    const groups = groupActions({
      unit, mode: 'idle', selectedUtilityIdx: null, phase: 'player', content: pack,
    });
    const ability = groups.class[0];
    expect(ability.label).toBe('Sight Active');
    expect(ability.disabled).toBe(true);
  });

  it('phase=enemy: only End Turn surfaces and it is disabled', () => {
    const pack = mkPack();
    const unit = mkUnit();
    const groups = groupActions({
      unit, mode: 'idle', selectedUtilityIdx: null, phase: 'enemy', content: pack,
    });
    expect(groups.primary).toEqual([]);
    expect(groups.utilities).toEqual([]);
    expect(groups.class).toEqual([]);
    expect(groups.system.length).toBe(1);
    expect(groups.system[0].id).toBe('endTurn');
    expect(groups.system[0].disabled).toBe(true);
  });
});

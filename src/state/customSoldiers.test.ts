import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from './gameStore';
import { getSoldierTemplate } from '../content/registry';
import type { SoldierTemplate } from '../game/types';

/**
 * Phase 5d — custom-soldier lookup override. gameStore.addCustomSoldier
 * stores player-authored templates in the customSoldiers map; registry's
 * getSoldierTemplate consults the map before falling back to the active
 * pack's catalog. The test validates the end-to-end lookup path without
 * touching the UI surface.
 */

function mkCustom(id: string, name: string): SoldierTemplate {
  return {
    id,
    name,
    class: 'Ranger',
    hpMax: 13, aim: 15, mobility: 4,
    portraitColor: '#ffffff',
    defaultLoadout: {
      primaryMods: {}, sidearmMods: {},
      primaryId: 'runeweave_carbine',
      sidearmId: 'sigilshot_pistol',
      armor: {
        chest: 'mithril_vest_chest',
        gauntlets: 'mithril_vest_gauntlets',
        legs: 'mithril_vest_legs',
      },
      utilityIds: ['embercore_orb'],
      kitId: null,
    },
    appearance: {
      rig: 'human',
      skinTone: 0xc48a6a,
      hairStyle: 'short_crop',
      hairColor: 0x1a1410,
      eyeColor: 0x3a2a1c,
      baseOutfit: 'fatigues',
    },
  };
}

describe('customSoldiers: lookup override + lifecycle', () => {
  beforeEach(() => {
    // Clear any custom soldiers from previous tests.
    const custom = useGameStore.getState().customSoldiers;
    for (const id of Object.keys(custom)) {
      useGameStore.getState().removeCustomSoldier(id);
    }
  });

  it('getSoldierTemplate returns a custom soldier before falling back to the pack catalog', () => {
    const tpl = mkCustom('custom_test_1', 'Test One');
    useGameStore.getState().addCustomSoldier(tpl);
    const resolved = getSoldierTemplate('custom_test_1');
    expect(resolved.name).toBe('Test One');
    expect(resolved.appearance).toBeDefined();
    expect(resolved.appearance!.rig).toBe('human');
  });

  it('addCustomSoldier also seeds the soldier a loadout from the template defaults', () => {
    const tpl = mkCustom('custom_test_2', 'Test Two');
    useGameStore.getState().addCustomSoldier(tpl);
    const loadout = useGameStore.getState().loadouts['custom_test_2'];
    expect(loadout).toBeDefined();
    expect(loadout.primaryId).toBe('runeweave_carbine');
    expect(loadout.armor).toEqual({
      chest: 'mithril_vest_chest',
      gauntlets: 'mithril_vest_gauntlets',
      legs: 'mithril_vest_legs',
    });
  });

  it('removeCustomSoldier drops the template + its loadout + rebinds roster slots to defaults', () => {
    const tpl = mkCustom('custom_test_3', 'Test Three');
    useGameStore.getState().addCustomSoldier(tpl);
    // Swap the custom soldier into roster slot 0.
    useGameStore.getState().setRosterSlot(0, 'custom_test_3');
    expect(useGameStore.getState().roster[0]).toBe('custom_test_3');

    useGameStore.getState().removeCustomSoldier('custom_test_3');
    // Gone from customSoldiers + loadouts.
    expect(useGameStore.getState().customSoldiers['custom_test_3']).toBeUndefined();
    expect(useGameStore.getState().loadouts['custom_test_3']).toBeUndefined();
    // Roster slot fell back to the active pack's first default soldier.
    const fallbackId = useGameStore.getState().roster[0];
    expect(fallbackId).not.toBe('custom_test_3');
  });

  it('falls through to the pack catalog for non-custom ids', () => {
    // Add a custom soldier to ensure the hook is active.
    useGameStore.getState().addCustomSoldier(mkCustom('custom_test_4', 'Test Four'));
    // A known pack soldier should still resolve via the fallback path.
    const kestrel = getSoldierTemplate('ranger_kestrel');
    expect(kestrel.name).toBe('Kestrel');
    expect(kestrel.appearance).toBeDefined(); // migrated in Phase 5b
  });

  it('renameCustomSoldier updates the name + persists; trims + clamps input', () => {
    const tpl = mkCustom('custom_test_5', 'Original');
    useGameStore.getState().addCustomSoldier(tpl);
    // Normal rename
    useGameStore.getState().renameCustomSoldier('custom_test_5', 'Renamed');
    expect(useGameStore.getState().customSoldiers['custom_test_5'].name).toBe('Renamed');
    // Whitespace trim
    useGameStore.getState().renameCustomSoldier('custom_test_5', '   Padded   ');
    expect(useGameStore.getState().customSoldiers['custom_test_5'].name).toBe('Padded');
    // Long input clamps to 32 chars
    const long = 'x'.repeat(50);
    useGameStore.getState().renameCustomSoldier('custom_test_5', long);
    expect(useGameStore.getState().customSoldiers['custom_test_5'].name.length).toBe(32);
    // Blank is a no-op (keeps previous name)
    useGameStore.getState().renameCustomSoldier('custom_test_5', '   ');
    expect(useGameStore.getState().customSoldiers['custom_test_5'].name.length).toBe(32);
    // Unknown id is a no-op (no throw)
    useGameStore.getState().renameCustomSoldier('no_such_id', 'Ghost');
    expect(useGameStore.getState().customSoldiers['no_such_id']).toBeUndefined();
  });

  it('rerollCustomSoldierAppearance replaces palette fields + preserves name/class/loadout', () => {
    const tpl = mkCustom('custom_test_6', 'Roller');
    useGameStore.getState().addCustomSoldier(tpl);
    const before = useGameStore.getState().customSoldiers['custom_test_6'];
    useGameStore.getState().rerollCustomSoldierAppearance('custom_test_6');
    const after = useGameStore.getState().customSoldiers['custom_test_6'];
    // Identity-preserving fields stay.
    expect(after.name).toBe(before.name);
    expect(after.class).toBe(before.class);
    expect(after.hpMax).toBe(before.hpMax);
    expect(after.defaultLoadout).toEqual(before.defaultLoadout);
    // Appearance still set, rig unchanged.
    expect(after.appearance).toBeDefined();
    expect(after.appearance!.rig).toBe('human');
    // At least one palette field is present. (Randomness could pick the
    // same swatch twice — assert the shape, not a specific change.)
    expect(typeof after.appearance!.skinTone).toBe('number');
    expect(typeof after.appearance!.hairColor).toBe('number');
    expect(typeof after.appearance!.eyeColor).toBe('number');
    expect(typeof after.appearance!.hairStyle).toBe('string');
    expect(typeof after.appearance!.baseOutfit).toBe('string');
  });
});

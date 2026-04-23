import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Vitest runs this file in a node environment (see vite.config.ts
 * test.environment), so localStorage is undefined by default. Shim it
 * at module init BEFORE importing gameStore — gameStore's loadPersisted
 * reads localStorage during its own init and we want deterministic
 * control over the v1/v2 keys.
 */
if (typeof (globalThis as { localStorage?: Storage }).localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  };
}

import { useGameStore } from './gameStore';
import { useContent } from '../content/registry';

/**
 * Phase 6a — v1 → v2 loadout persistence migration. Older saves carry
 * `armorId: 'warded_plate'` (a single monolith); post-6a the Loadout
 * shape is `armor: Partial<Record<ArmorSlot, string>>`. `loadPersisted`
 * reads the v1 key, maps each monolith id through V1_TO_V2_ARMOR, and
 * writes the resulting per-slot map back as v2.
 *
 * The migration must preserve every other Loadout field verbatim (weapons,
 * mods, utilities, kit, clothing) and must be idempotent — running it
 * on a v2 payload should be a no-op.
 */
describe('gameStore: v1 → v2 loadout migration', () => {
  const packId = useContent().id;
  const v1Key = `tactical.${packId}.squadLoadouts.v1`;
  const v2Key = `tactical.${packId}.squadLoadouts.v2`;

  beforeEach(() => {
    localStorage.removeItem(v1Key);
    localStorage.removeItem(v2Key);
  });

  it('migrates a v1 payload with a monolith armorId into the per-slot map', () => {
    const v1 = {
      warden_brannock: {
        primaryId: 'runeweave_carbine',
        primaryMods: {},
        sidearmId: 'sigilshot_pistol',
        sidearmMods: {},
        armorId: 'warded_plate',
        utilityIds: ['embercore_orb'],
        kitId: 'salvagers_webbing',
      },
    };
    localStorage.setItem(v1Key, JSON.stringify(v1));

    useGameStore.getState().reloadFromActivePack();
    const l = useGameStore.getState().loadouts['warden_brannock'];

    expect(l.armor).toEqual({
      chest: 'warded_plate_chest',
      gauntlets: 'warded_plate_gauntlets',
      legs: 'warded_plate_legs',
    });
    // Other fields preserved.
    expect(l.primaryId).toBe('runeweave_carbine');
    expect(l.utilityIds).toEqual(['embercore_orb']);
    expect(l.kitId).toBe('salvagers_webbing');

    // v1 key is dropped + v2 key is written.
    expect(localStorage.getItem(v1Key)).toBeNull();
    expect(localStorage.getItem(v2Key)).toBeTruthy();
  });

  it('is a no-op when v2 payload is already persisted', () => {
    const v2 = {
      warden_brannock: {
        primaryId: 'runeweave_carbine',
        primaryMods: {},
        sidearmId: 'sigilshot_pistol',
        sidearmMods: {},
        armor: {
          chest: 'mithril_vest_chest',
          legs: 'field_harness_legs',
        },
        utilityIds: [],
        kitId: null,
      },
    };
    localStorage.setItem(v2Key, JSON.stringify(v2));

    useGameStore.getState().reloadFromActivePack();
    const l = useGameStore.getState().loadouts['warden_brannock'];

    expect(l.armor).toEqual({
      chest: 'mithril_vest_chest',
      legs: 'field_harness_legs',
    });
  });

  it('unknown v1 armorId falls through to an empty armor map', () => {
    const v1 = {
      warden_brannock: {
        primaryId: 'runeweave_carbine',
        primaryMods: {},
        sidearmId: 'sigilshot_pistol',
        sidearmMods: {},
        armorId: 'deleted_from_pack',
        utilityIds: [],
        kitId: null,
      },
    };
    localStorage.setItem(v1Key, JSON.stringify(v1));

    useGameStore.getState().reloadFromActivePack();
    const l = useGameStore.getState().loadouts['warden_brannock'];

    expect(l.armor).toEqual({});
  });
});

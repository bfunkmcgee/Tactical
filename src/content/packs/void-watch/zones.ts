import type { Zone, Consumable } from '../../../game/types';

export const ZONES: Zone[] = [
  {
    id: 'derelict-sweep',
    name: 'Derelict Sweep',
    description: 'A two-deck boarding op on the silent hulk of the colony ship Bulwark. Clear the mess hall, then the chapel.',
    biome: 'derelict',
    skirmishChance: 0.2,
    consumableGrant: { ammo_crate: 1, med_cache: 1 },
    missions: [
      {
        id: 'mess-hall',
        name: 'Mess Hall',
        briefing: 'The loudest signal echoes from the mess deck. Sweep and hold.',
        mapId: 'ruined_market',   // reused engine map, spawnLegend remaps enemies to Hollows
        objective: { kind: 'eliminate_all' },
      },
      {
        id: 'chapel-sweep',
        name: 'Ship Chapel',
        briefing: 'Concentrations of Hollows cluster near the ship chapel. Push through.',
        mapId: 'rust_chapel',
        objective: { kind: 'eliminate_all' },
      },
    ],
    skirmishes: [],
  },
];

export const CONSUMABLES: Record<string, Consumable> = {
  ammo_crate: {
    id: 'ammo_crate',
    name: 'Ammo Crate',
    flavor: 'Standard Void-Watch resupply drop.',
    kind: 'ammo_crate',
    tag: 'mundane',
  },
  med_cache: {
    id: 'med_cache',
    name: 'Trauma Kit',
    flavor: 'Auto-injectors and hemostatic foam in a mag-sealed tube.',
    kind: 'med_cache',
    tag: 'mundane',
  },
};

export const INITIAL_STOCKPILE: Record<string, number> = {
  ammo_crate: 2,
  med_cache: 1,
};

import type { Zone, Consumable } from '../../../game/types';

/**
 * Eagle Corps zones. Phase-1 ships the entry zone only; each of its three
 * missions is a straight "eliminate all hostiles" until the MissionObjective
 * handlers land.
 */
export const ZONES: Zone[] = [
  {
    id: 'salvage-run',
    name: 'Salvage Run',
    description: 'Sweep Rust Choir scavenger camps off the old market and shrine grid before they entrench.',
    biome: 'desert',
    skirmishChance: 0.35,
    consumableGrant: { ammo_crate: 1, med_cache: 1, armor_patch: 1, field_wash: 1 },
    missions: [
      {
        id: 'market-sweep',
        name: 'Market Sweep',
        briefing: 'A scavenger band has nested in the ruined market. Clear the stalls before nightfall.',
        mapId: 'ruined_market',
        objective: { kind: 'eliminate_all' },
      },
      {
        id: 'chapel-assault',
        name: 'Chapel Assault',
        briefing: 'Signals pull us toward a chapel deep in Choir territory. Expect a war-priest on the altar.',
        mapId: 'rust_chapel',
        objective: { kind: 'eliminate_all' },
      },
      {
        id: 'market-return',
        name: 'Rearguard',
        briefing: 'Choir reinforcements are pouring back into the market. Hold the aisles one more time.',
        mapId: 'ruined_market',
        objective: { kind: 'eliminate_all' },
      },
    ],
    skirmishes: [
      {
        id: 'raider-ambush',
        name: 'Raider Ambush',
        flavor: 'A goblin band drops out of the rafters between missions.',
        mapId: 'ruined_market',
        objective: { kind: 'eliminate_all' },
        weight: 1,
      },
    ],
  },
];

export const CONSUMABLES: Record<string, Consumable> = {
  ammo_crate: {
    id: 'ammo_crate',
    name: 'Ammo Crate',
    flavor: 'Crash-box of cartridges dropped at the Excursion Overview.',
    kind: 'ammo_crate',
    tag: 'mundane',
  },
  med_cache: {
    id: 'med_cache',
    name: 'Med Cache',
    flavor: 'Phoenix-draught field kit. +4 HP to every living soldier.',
    kind: 'med_cache',
    tag: 'alchemical',
  },
  armor_patch: {
    id: 'armor_patch',
    name: 'Armor Patch',
    flavor: 'Ceramic plate inserts and sigil-thread. Cuts armor damage in half.',
    kind: 'armor_patch',
    tag: 'runic',
  },
  field_wash: {
    id: 'field_wash',
    name: 'Field Wash',
    flavor: 'Alchemical solvent that strips grime. Clean kit, clear sightlines.',
    kind: 'field_wash',
    tag: 'alchemical',
  },
  reinforcement: {
    id: 'reinforcement',
    name: 'Reinforcement Drop',
    flavor: 'A ropeline insertion from another Eagle Corps fire team.',
    kind: 'reinforcement',
    tag: 'runic',
  },
};

export const INITIAL_STOCKPILE: Record<string, number> = {
  ammo_crate: 2,
  med_cache: 2,
  armor_patch: 1,
  field_wash: 2,
  reinforcement: 1,
};

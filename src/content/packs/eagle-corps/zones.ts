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

  /**
   * Refinery Raid — the campaign's first real campaign. Four mission
   * arc tracking the Rust Choir's fuel supply back to the Eldersands
   * Refinery. Each briefing hands off to the next: knock their comms
   * offline, sweep the oasis they retreat to, break the refinery's
   * outer gate, then assault the tanks themselves.
   *
   * Stockpile is generous because the fourth fight is the longest in
   * the build.
   */
  {
    id: 'refinery-raid',
    name: 'Refinery Raid',
    description: 'Follow the Choir\'s supply line back to the Eldersands Refinery and shut their fuel rigs down for good.',
    biome: 'desert',
    skirmishChance: 0.4,
    consumableGrant: { ammo_crate: 2, med_cache: 2, armor_patch: 1, field_wash: 1, reinforcement: 1 },
    missions: [
      {
        id: 'rr-signal-relay',
        name: 'Silence the Wire',
        briefing: 'Choir runners hold a hilltop signal relay two ridges west of the refinery. If they raise their tower, the refinery gets a day\'s warning — and we lose the element of surprise. Knock the relay offline — the operators aren\'t the mission.',
        mapId: 'signal_relay',
        // The relay tower sits at the centre of the signal_relay map
        // (between the H cluster, at (7,7)). Drop it to zero HP and
        // the mission ends — enemies don't need to die.
        objective: { kind: 'destroy_objective', pos: { x: 7, y: 7 }, hp: 18 },
      },
      {
        id: 'rr-dry-well',
        name: 'Dry Well',
        briefing: 'With the relay silent, the Choir is falling back to a collapsed oasis to regroup. A pursuit force at our rear costs lives at the refinery — finish them at the well before they dig in.',
        mapId: 'dry_well',
        objective: { kind: 'eliminate_all' },
      },
      {
        id: 'rr-gate-watch',
        name: 'Gate Watch',
        briefing: 'The refinery\'s outer gate is flanked by twin scrap-iron watchtowers manned around the clock. Drop both towers and crack the gate — the squad can\'t push through to the tanks with guns in their back.',
        mapId: 'gate_watch',
        objective: { kind: 'eliminate_all' },
      },
      {
        id: 'rr-eldersands-refinery',
        name: 'Eldersands Refinery',
        briefing: 'Last push. Choir has turned the storage tanks into bunkers and the pipe runs into a kill-box. Root every one of them out — Eagle Corps doesn\'t leave the field with a refinery on fire.',
        mapId: 'desert_refinery',
        objective: { kind: 'eliminate_all' },
      },
    ],
    skirmishes: [
      {
        id: 'rr-pipe-ambush',
        name: 'Pipe-run Ambush',
        flavor: 'Goblins break from a row of steam pipes as the squad marches on.',
        mapId: 'desert_refinery',
        objective: { kind: 'eliminate_all' },
        weight: 1,
      },
      {
        id: 'rr-dune-raiders',
        name: 'Dune Raiders',
        flavor: 'Scrap-clad raiders hit the column from the open dunes at the oasis edge.',
        mapId: 'dry_well',
        objective: { kind: 'eliminate_all' },
        weight: 1,
      },
      {
        id: 'rr-berserker-charge',
        name: 'Berserker Charge',
        flavor: 'A pack of rage-painted berserkers breaks from cover and sprints at the squad.',
        mapId: 'dry_well',
        // Remap the oasis's G/O/T spawns to berserkers so this skirmish
        // is a sprint-in-melee fight without a new authored map.
        spawnsOverride: { G: 'rust_berserker', O: 'rust_berserker', T: 'rust_berserker' },
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

import type { Utility } from '../../../game/types';

export const UTILITIES: Record<string, Utility> = {
  embercore_orb: {
    id: 'embercore_orb',
    name: 'Embercore Orb',
    flavor: 'A glass sphere holding a caged ember; shatters in a gout of draconic fire.',
    kind: 'grenade',
    charges: 2, radius: 2, range: 7,
    dmgMin: 4, dmgMax: 6, apCost: 1,
    tag: 'draconic',
  },
  faewisp_flare: {
    id: 'faewisp_flare',
    name: 'Faewisp Flare',
    flavor: 'Releases a swarm of luminous fae wisps that blind all in their radius.',
    kind: 'flashbang',
    charges: 2, radius: 2, range: 6, apCost: 1,
    tag: 'fae',
  },
  mistvial: {
    id: 'mistvial',
    name: 'Mistvial',
    flavor: 'Alchemical vial that bursts into a dense, line-of-sight-breaking mist.',
    kind: 'smoke',
    charges: 2, radius: 3, range: 6, apCost: 1,
    tag: 'alchemical',
  },
  phoenix_draught: {
    id: 'phoenix_draught',
    name: 'Phoenix Draught',
    flavor: 'A modern medkit augmented with distilled phoenix plume.',
    kind: 'medkit',
    charges: 2, radius: 0, range: 1, heal: 6, apCost: 1,
    tag: 'alchemical',
  },
};

export const ALL_UTILITIES = Object.values(UTILITIES);

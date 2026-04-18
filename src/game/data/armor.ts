import type { Armor } from '../types';

export const ARMOR: Record<string, Armor> = {
  warded_plate: {
    id: 'warded_plate',
    name: 'Warded Plate Carrier',
    flavor: 'Heavy ceramic plates bound with warding runes; stops most things.',
    hpBonus: 4, dr: 2, mobility: -1,
    tag: 'runic',
  },
  mithril_vest: {
    id: 'mithril_vest',
    name: 'Mithril-Laced Vest',
    flavor: 'A weave of mithril mesh beneath a standard combat vest.',
    hpBonus: 2, dr: 1, mobility: 0,
    tag: 'mundane',
  },
  swiftstep_greaves: {
    id: 'swiftstep_greaves',
    name: 'Swiftstep Greaves',
    flavor: 'Light leg armor with elvenstep charms for extra pace.',
    hpBonus: 1, dr: 0, mobility: 1,
    tag: 'fae',
  },
  oakheart_helm: {
    id: 'oakheart_helm',
    name: 'Oakheart Helm',
    flavor: 'Kevlar shell reinforced with heartwood; quiet and tough.',
    hpBonus: 3, dr: 1, mobility: 0,
    tag: 'alchemical',
  },
};

export const ALL_ARMOR = Object.values(ARMOR);

import type { EnemyTemplate } from '../types';

export const ENEMIES: Record<string, EnemyTemplate> = {
  wraith_raider: {
    id: 'wraith_raider',
    name: 'Wraith Raider',
    hpMax: 7, aim: 60, mobility: 3,
    dmgMin: 3, dmgMax: 5,
    rangeShort: 6, rangeLong: 12,
    kind: 'ranged',
    color: '#8a7bb3',
  },
  gutter_troll: {
    id: 'gutter_troll',
    name: 'Gutter Troll',
    hpMax: 16, aim: 55, mobility: 3,
    dmgMin: 5, dmgMax: 8,
    rangeShort: 1, rangeLong: 1,
    kind: 'melee',
    color: '#6b8457',
  },
};

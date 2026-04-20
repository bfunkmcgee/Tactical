import type { EnemyTemplate } from '../../../game/types';

/**
 * The Hollow — wraith-like echoes from beyond the bulkheads. One enemy type;
 * the spawnLegend maps every map's abstract spawn key (G/O/T) to this same
 * template, so a Void-Watch deployment on the Ruined Market spawns four
 * Hollows instead of the goblin/orc/troll mix. Validates map reuse.
 */
export const ENEMIES: Record<string, EnemyTemplate> = {
  hollow_wraith: {
    id: 'hollow_wraith',
    name: 'Hollow Wraith',
    hpMax: 8,
    aim: 60,
    mobility: 4,
    dmgMin: 3, dmgMax: 5,
    rangeShort: 6, rangeLong: 12,
    kind: 'ranged',
    color: '#7a8fb0',
  },
};

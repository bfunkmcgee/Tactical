import type { EnemyTemplate } from '../../../game/types';

/**
 * The Hollow — wraith-like echoes from beyond the bulkheads. One enemy type;
 * the spawnLegend maps every map's abstract spawn key (G/O/T) to this same
 * template, so a Void-Watch deployment on the Ruined Market spawns four
 * Hollows instead of the goblin/orc/troll mix. Validates map reuse.
 *
 * Phase 6e: the Wraith rides the shared human rig with a cold slate
 * skinTone to read as a translucent echo. No bespoke per-part art yet;
 * a dedicated ghost rig variant (non-human silhouette, alpha blending)
 * is tracked as future content work.
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
    fireClass: 'rifle',
    appearance: {
      rig: 'human',
      skinTone: 0x7a8fb0,       // cold slate — matches the template color
      hairStyle: 'bald',
      hairColor: 0x7a8fb0,
      eyeColor: 0xb8c8d8,
      baseOutfit: 'fatigues',
    },
  },
};

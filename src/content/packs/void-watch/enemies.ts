import type { EnemyTemplate } from '../../../game/types';

/**
 * The Hollow — wraith-like echoes from beyond the bulkheads. One enemy type;
 * the spawnLegend maps every map's abstract spawn key (G/O/T) to this same
 * template, so a Void-Watch deployment on the Ruined Market spawns four
 * Hollows instead of the goblin/orc/troll mix. Validates map reuse.
 *
 * Phase 6e initially shipped the Wraith on the human rig with a slate
 * skinTone — readable but not really ghost-like. The follow-up gives
 * it dedicated per-part art under public/styles/flat/enemies/wraith/:
 * translucent cyan-blue silhouettes, a hooded cowl head with two
 * glowing eye-points, no solid feet (the legs trail off into a wisp).
 * Still rig-composed via partOverrides so the standard rig animations
 * (foot-plant, torso lean, head counter-lean, arms-back sway, arms-
 * front aim) still drive its movement. skinTone stays identity since
 * the bespoke art carries its own palette.
 */
const WRAITH_DIR = '/styles/flat/enemies/wraith';
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
      skinTone: 0xffffff,
      partOverrides: {
        legs:         `${WRAITH_DIR}/wraith_legs.svg`,
        torso:        `${WRAITH_DIR}/wraith_torso.svg`,
        head:         `${WRAITH_DIR}/wraith_head.svg`,
        'arms-back':  `${WRAITH_DIR}/wraith_arms_back.svg`,
        'arms-front': `${WRAITH_DIR}/wraith_arms_front.svg`,
      },
    },
  },
};

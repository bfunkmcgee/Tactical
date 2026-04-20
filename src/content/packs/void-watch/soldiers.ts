import type { SoldierTemplate } from '../../../game/types';

/**
 * Two operatives — small enough that a 4-spawn map will leave two slots empty,
 * which is fine: combatStore.init iterates `roster.length`, not all spawn
 * positions. Validates the engine handles short rosters gracefully.
 */
export const SOLDIERS: Record<string, SoldierTemplate> = {
  vex_operator: {
    id: 'vex_operator',
    name: 'Vex',
    class: 'Operator',
    hpMax: 12, aim: 5, mobility: 4,
    portraitColor: '#9bd4ff',
    defaultLoadout: {
      primaryId: 'pulse_rifle',
      primaryMods: { optic: 'optic_targeting_computer' },
      sidearmId: 'service_pistol',
      sidearmMods: {},
      armorId: 'eva_plate',
      utilityIds: ['plasma_charge', 'stim_patch'],
      kitId: 'hardpoint_webbing',
    },
  },
  kade_sentinel: {
    id: 'kade_sentinel',
    name: 'Kade',
    class: 'Sentinel',
    hpMax: 9, aim: 15, mobility: 4,
    portraitColor: '#ffe18a',
    defaultLoadout: {
      primaryId: 'mag_lance',
      primaryMods: { stock: 'stock_stabilizer' },
      sidearmId: 'shock_baton',
      sidearmMods: {},
      armorId: 'suit_lining',
      utilityIds: ['stim_patch'],
      kitId: 'marksman_rig',
    },
  },
};

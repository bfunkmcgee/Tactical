import type { SoldierTemplate } from '../types';

export const SOLDIERS: Record<string, SoldierTemplate> = {
  ranger_kestrel: {
    id: 'ranger_kestrel',
    name: 'Kestrel',
    class: 'Ranger',
    hpMax: 10, aim: 10, mobility: 4,
    portraitColor: '#7cc4ff',
    defaultLoadout: {
      primaryId: 'runeweave_carbine',
      sidearmId: 'sigilshot_pistol',
      armorId: 'mithril_vest',
      utilityIds: ['embercore_orb', 'phoenix_draught'],
      kitId: 'salvagers_webbing',
    },
  },
  warden_brannock: {
    id: 'warden_brannock',
    name: 'Brannock',
    class: 'Warden',
    hpMax: 14, aim: 0, mobility: 3,
    portraitColor: '#ff9a3c',
    defaultLoadout: {
      primaryId: 'dragonmaw_autocannon',
      sidearmId: 'thornlock_revolver',
      armorId: 'warded_plate',
      utilityIds: ['mistvial', 'phoenix_draught'],
      kitId: 'warden_plate',
    },
  },
  mystic_seraphine: {
    id: 'mystic_seraphine',
    name: 'Seraphine',
    class: 'Mystic',
    hpMax: 9, aim: 15, mobility: 4,
    portraitColor: '#c79aff',
    defaultLoadout: {
      primaryId: 'arclight_marksman',
      sidearmId: 'sigilshot_pistol',
      armorId: 'swiftstep_greaves',
      utilityIds: ['faewisp_flare', 'mistvial'],
      kitId: 'spotters_lens',
    },
  },
  sapper_orin: {
    id: 'sapper_orin',
    name: 'Orin',
    class: 'Sapper',
    hpMax: 11, aim: 5, mobility: 4,
    portraitColor: '#9cd6a6',
    defaultLoadout: {
      primaryId: 'hexbore_scattergun',
      sidearmId: 'thornlock_revolver',
      armorId: 'oakheart_helm',
      utilityIds: ['embercore_orb', 'embercore_orb'],
      kitId: 'alchemists_satchel',
    },
  },
};

export const ALL_SOLDIERS = Object.values(SOLDIERS);

import type { SoldierTemplate } from '../../../game/types';

/**
 * Eagle Corps soldier templates. Each template carries an `appearance`
 * block so the renderer composes the unit via the human rig. The
 * per-soldier identity (Kestrel's blue-scout energy, Seraphine's robed
 * mystic silhouette, etc.) is encoded in two layers:
 *
 *   1. appearance.baseOutfit + hair + palette — what they look like
 *      without armor: civvies, hair, skin tone, eyes.
 *   2. defaultLoadout.armor → per-slot Armor pieces — what their
 *      class-canonical armor looks like bolted on top. See armor.ts
 *      for the overlay SVGs (they re-use the existing per-class
 *      torso/arms files as Visual.overlays).
 *
 * Per Phase 6e, the rig renderer is the only code path for shipping
 * templates — the legacy bespoke body/arms fallback has been retired.
 */
export const SOLDIERS: Record<string, SoldierTemplate> = {
  ranger_kestrel: {
    id: 'ranger_kestrel',
    name: 'Kestrel',
    class: 'Ranger',
    hpMax: 13, aim: 15, mobility: 4,
    portraitColor: '#7cc4ff',
    defaultLoadout: {
      primaryMods: {}, sidearmMods: {},
      primaryId: 'runeweave_carbine',
      sidearmId: 'sigilshot_pistol',
      armor: {
        chest: 'mithril_vest_chest',
        gauntlets: 'mithril_vest_gauntlets',
        legs: 'mithril_vest_legs',
      },
      utilityIds: ['embercore_orb', 'phoenix_draught'],
      kitId: 'salvagers_webbing',
    },
    appearance: {
      rig: 'human',
      skinTone: 0xe8c4a4, // fair (baked into part SVGs; kept for any slot
                          // that falls back to the shared rig part)
      hairStyle: 'short_crop',
      hairColor: 0x1a1410, // black
      eyeColor: 0x4a6a9a,  // blue
      baseOutfit: 'fatigues',
      partOverrides: {
        legs:         '/styles/flat/soldiers/kestrel/kestrel_legs.svg',
        torso:        '/styles/flat/soldiers/kestrel/kestrel_torso.svg',
        'arms-back':  '/styles/flat/soldiers/kestrel/kestrel_arms_back.svg',
        head:         '/styles/flat/soldiers/kestrel/kestrel_head.svg',
        'arms-front': '/styles/flat/soldiers/kestrel/kestrel_arms_front.svg',
      },
    },
  },
  warden_brannock: {
    id: 'warden_brannock',
    name: 'Brannock',
    class: 'Warden',
    hpMax: 17, aim: 5, mobility: 3,
    portraitColor: '#ff9a3c',
    defaultLoadout: {
      primaryMods: {}, sidearmMods: {},
      primaryId: 'dragonmaw_autocannon',
      sidearmId: 'thornlock_revolver',
      armor: {
        chest: 'warded_plate_chest',
        gauntlets: 'warded_plate_gauntlets',
        legs: 'warded_plate_legs',
      },
      utilityIds: ['mistvial', 'phoenix_draught'],
      kitId: 'warden_plate',
    },
    appearance: {
      rig: 'human',
      skinTone: 0x9a6a4a, // tan
      hairStyle: 'bald',
      hairColor: 0x4a3020, // brown (stubble / beard tint)
      eyeColor: 0x6a4a28,  // hazel
      baseOutfit: 'utility',
      partOverrides: {
        legs:         '/styles/flat/soldiers/brannock/brannock_legs.svg',
        torso:        '/styles/flat/soldiers/brannock/brannock_torso.svg',
        'arms-back':  '/styles/flat/soldiers/brannock/brannock_arms_back.svg',
        head:         '/styles/flat/soldiers/brannock/brannock_head.svg',
        'arms-front': '/styles/flat/soldiers/brannock/brannock_arms_front.svg',
      },
    },
  },
  mystic_seraphine: {
    id: 'mystic_seraphine',
    name: 'Seraphine',
    class: 'Mystic',
    hpMax: 12, aim: 20, mobility: 4,
    portraitColor: '#c79aff',
    defaultLoadout: {
      primaryMods: {}, sidearmMods: {},
      primaryId: 'arclight_marksman',
      sidearmId: 'sigilshot_pistol',
      armor: {
        chest: 'swiftstep_greaves_chest',
        gauntlets: 'swiftstep_greaves_gauntlets',
        legs: 'swiftstep_greaves_legs',
      },
      utilityIds: ['faewisp_flare', 'mistvial'],
      kitId: 'spotters_lens',
    },
    appearance: {
      rig: 'human',
      skinTone: 0xe8c4a4, // fair
      hairStyle: 'ponytail',
      hairColor: 0xe8e4d8, // white
      eyeColor: 0x6a7078,  // grey
      baseOutfit: 'robes',
      partOverrides: {
        legs:         '/styles/flat/soldiers/seraphine/seraphine_legs.svg',
        torso:        '/styles/flat/soldiers/seraphine/seraphine_torso.svg',
        'arms-back':  '/styles/flat/soldiers/seraphine/seraphine_arms_back.svg',
        head:         '/styles/flat/soldiers/seraphine/seraphine_head.svg',
        'arms-front': '/styles/flat/soldiers/seraphine/seraphine_arms_front.svg',
      },
    },
  },
  sapper_orin: {
    id: 'sapper_orin',
    name: 'Orin',
    class: 'Sapper',
    hpMax: 14, aim: 10, mobility: 4,
    portraitColor: '#9cd6a6',
    defaultLoadout: {
      primaryMods: {}, sidearmMods: {},
      primaryId: 'hexbore_scattergun',
      sidearmId: 'thornlock_revolver',
      armor: {
        chest: 'oakheart_helm_chest',
        gauntlets: 'oakheart_helm_gauntlets',
        legs: 'oakheart_helm_legs',
      },
      utilityIds: ['embercore_orb', 'embercore_orb'],
      kitId: 'alchemists_satchel',
    },
    appearance: {
      rig: 'human',
      skinTone: 0xc48a6a, // medium
      hairStyle: 'bob',
      hairColor: 0x7a3a20, // auburn
      eyeColor: 0x3a5a3a,  // green
      baseOutfit: 'utility',
      partOverrides: {
        legs:         '/styles/flat/soldiers/orin/orin_legs.svg',
        torso:        '/styles/flat/soldiers/orin/orin_torso.svg',
        'arms-back':  '/styles/flat/soldiers/orin/orin_arms_back.svg',
        head:         '/styles/flat/soldiers/orin/orin_head.svg',
        'arms-front': '/styles/flat/soldiers/orin/orin_arms_front.svg',
      },
    },
  },
};

export const ALL_SOLDIERS = Object.values(SOLDIERS);

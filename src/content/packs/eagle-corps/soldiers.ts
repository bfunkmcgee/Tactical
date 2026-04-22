import type { SoldierTemplate } from '../../../game/types';

/**
 * Eagle Corps soldier templates. As of Phase 5b each template carries an
 * `appearance` block so the renderer composes the unit via the human rig
 * rather than the legacy bespoke `${id}:body/arms/weapon` SVG path. The
 * per-soldier identity (Kestrel's blue-scout energy, Seraphine's robed
 * mystic silhouette, etc.) is encoded in two layers:
 *
 *   1. appearance.baseOutfit + hair + palette — what they look like
 *      without armor: civvies, hair, skin tone, eyes.
 *   2. defaultLoadout.armorId → Armor.visual — what their class-canonical
 *      armor looks like bolted on top. See armor.ts for the overlay SVGs
 *      (they re-use the existing per-class torso/arms files).
 *
 * The legacy bespoke SVGs are still in the tree as fallback. A template
 * without `appearance` continues to render through pack.theme.spritePath
 * unchanged.
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
      armorId: 'mithril_vest',
      utilityIds: ['embercore_orb', 'phoenix_draught'],
      kitId: 'salvagers_webbing',
    },
    appearance: {
      rig: 'human',
      skinTone: 0xe8c4a4, // fair
      hairStyle: 'short_crop',
      hairColor: 0x1a1410, // black
      eyeColor: 0x4a6a9a,  // blue
      baseOutfit: 'fatigues',
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
      armorId: 'warded_plate',
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
      armorId: 'swiftstep_greaves',
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
      armorId: 'oakheart_helm',
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
    },
  },
};

export const ALL_SOLDIERS = Object.values(SOLDIERS);

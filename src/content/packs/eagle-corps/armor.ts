import type { Armor } from '../../../game/types';

/**
 * Eagle Corps armor entries — per-slot pieces.
 *
 * Phase 6a decomposed what used to be monolithic "armor sets" into
 * individual per-slot pieces. Each piece fills one ArmorSlot
 * (helmet / shoulders / chest / legs / gauntlets) and contributes its
 * own stats + visuals. A Loadout now carries an `armor` map keyed on
 * ArmorSlot; mkSoldierUnit + unitArmor aggregate hpBonus / dr / mobility
 * across every equipped piece.
 *
 * Stats for the legacy 7 monoliths were split pragmatically — the bulk
 * of hpBonus + dr lives on the chest, mobility lives on the legs,
 * trim (gauntlets/shoulders/helmet) carries the remainder. Totals per
 * "set" match the legacy stats so mid-run migrations don't quietly
 * buff or nerf squads (see src/state/gameStore.ts V1_TO_V2_ARMOR).
 *
 * Class-canonical chest pieces (warded_plate / mithril_vest /
 * swiftstep_greaves / oakheart_helm) reference torso-only overlays
 * under /styles/flat/armor/class/. Gauntlet overlays still reuse the
 * legacy soldier_*_arms.svg files, which are arms-local and don't
 * bleed outside the arms-front sprite.
 */
export const ARMOR: Record<string, Armor> = {
  // ---- warded_plate (Brannock's Heavy Plate): hp 4 / dr 2 / mob -1 ----
  warded_plate_chest: {
    id: 'warded_plate_chest',
    name: 'Warded Plate Carrier',
    flavor: 'Heavy ceramic plates bound with warding runes.',
    slot: 'chest',
    hpBonus: 2, dr: 1, mobility: 0, tag: 'runic',
    visual: { overlays: {
      torso: { svg: '/styles/flat/armor/class/warden_plate_chest.svg' },
    }},
  },
  warded_plate_gauntlets: {
    id: 'warded_plate_gauntlets',
    name: 'Warded Plate Gauntlets',
    flavor: 'Rune-etched bracers match the chest carrier.',
    slot: 'gauntlets',
    hpBonus: 0, dr: 0, mobility: 0, tag: 'runic',
    visual: { overlays: {
      'gauntlet-front': { svg: '/styles/flat/soldier_warden_arms.svg' },
    }},
  },
  warded_plate_legs: {
    id: 'warded_plate_legs',
    name: 'Warded Plate Greaves',
    flavor: 'Segmented leg plates over combat trousers.',
    slot: 'legs',
    hpBonus: 2, dr: 1, mobility: -1, tag: 'runic',
    visual: { overlays: {
      legs: { svg: '/styles/flat/armor_legs/warded_plate_legs.svg' },
    }},
  },

  // ---- mithril_vest (Kestrel's baseline): hp 2 / dr 1 / mob 0 ----
  mithril_vest_chest: {
    id: 'mithril_vest_chest',
    name: 'Mithril-Laced Vest',
    flavor: 'A weave of mithril mesh beneath a standard combat vest.',
    slot: 'chest',
    hpBonus: 2, dr: 1, mobility: 0, tag: 'mundane',
    visual: { overlays: {
      torso: { svg: '/styles/flat/armor/class/ranger_carapace_chest.svg' },
    }},
  },
  mithril_vest_gauntlets: {
    id: 'mithril_vest_gauntlets',
    name: 'Reinforced Gloves',
    flavor: 'Standard issue combat gloves, lightly padded.',
    slot: 'gauntlets',
    hpBonus: 0, dr: 0, mobility: 0, tag: 'mundane',
    visual: { overlays: {
      'gauntlet-front': { svg: '/styles/flat/soldier_arms.svg' },
    }},
  },
  mithril_vest_legs: {
    id: 'mithril_vest_legs',
    name: 'Combat Trousers',
    flavor: 'Durable fatigues with knee reinforcement.',
    slot: 'legs',
    hpBonus: 0, dr: 0, mobility: 0, tag: 'mundane',
    visual: { overlays: {
      legs: { svg: '/styles/flat/armor_legs/mithril_vest_legs.svg' },
    }},
  },

  // ---- swiftstep_greaves (Seraphine's baseline): hp 1 / dr 0 / mob +1 ----
  swiftstep_greaves_chest: {
    id: 'swiftstep_greaves_chest',
    name: 'Mystic Vestments',
    flavor: 'Light robes woven with elvenstep charms.',
    slot: 'chest',
    hpBonus: 0, dr: 0, mobility: 0, tag: 'fae',
    visual: { overlays: {
      torso: { svg: '/styles/flat/armor/class/mystic_robes_chest.svg' },
    }},
  },
  swiftstep_greaves_gauntlets: {
    id: 'swiftstep_greaves_gauntlets',
    name: 'Rune-Stitched Bracers',
    flavor: 'Light bracers with fae-thread stitching.',
    slot: 'gauntlets',
    hpBonus: 0, dr: 0, mobility: 0, tag: 'fae',
    visual: { overlays: {
      'gauntlet-front': { svg: '/styles/flat/soldier_mystic_arms.svg' },
    }},
  },
  swiftstep_greaves_legs: {
    id: 'swiftstep_greaves_legs',
    name: 'Swiftstep Greaves',
    flavor: 'Light leg armor with elvenstep charms for extra pace.',
    slot: 'legs',
    hpBonus: 1, dr: 0, mobility: 1, tag: 'fae',
    visual: { overlays: {
      legs: { svg: '/styles/flat/armor_legs/swiftstep_greaves_legs.svg' },
    }},
  },

  // ---- oakheart_helm (Orin's baseline): hp 3 / dr 1 / mob 0 ----
  oakheart_helm_chest: {
    id: 'oakheart_helm_chest',
    name: "Sapper's Heartwood Vest",
    flavor: 'Kevlar shell reinforced with heartwood; quiet and tough.',
    slot: 'chest',
    hpBonus: 3, dr: 1, mobility: 0, tag: 'alchemical',
    visual: { overlays: {
      torso: { svg: '/styles/flat/armor/class/sapper_rig_chest.svg' },
    }},
  },
  oakheart_helm_gauntlets: {
    id: 'oakheart_helm_gauntlets',
    name: 'Tinkerer Gauntlets',
    flavor: 'Fingerless gloves with heartwood wrist guards.',
    slot: 'gauntlets',
    hpBonus: 0, dr: 0, mobility: 0, tag: 'alchemical',
    visual: { overlays: {
      'gauntlet-front': { svg: '/styles/flat/soldier_sapper_arms.svg' },
    }},
  },
  oakheart_helm_legs: {
    id: 'oakheart_helm_legs',
    name: 'Sapper Trousers',
    flavor: 'Cargo trousers with tool pouches on every pocket.',
    slot: 'legs',
    hpBonus: 0, dr: 0, mobility: 0, tag: 'alchemical',
    visual: { overlays: {
      legs: { svg: '/styles/flat/armor_legs/oakheart_helm_legs.svg' },
    }},
  },

  // ---- Basic combat armor tier — class-agnostic ----

  // field_harness (light): hp 1 / dr 0 / mob +1
  field_harness_chest: {
    id: 'field_harness_chest',
    name: 'Field Harness',
    flavor: 'Webbing vest with mag pouches. Light and fast.',
    slot: 'chest',
    hpBonus: 1, dr: 0, mobility: 0, tag: 'mundane',
    visual: { overlays: {
      torso: { svg: '/styles/flat/armor/basic/field_harness_torso.svg' },
    }},
  },
  field_harness_legs: {
    id: 'field_harness_legs',
    name: 'Field Trousers',
    flavor: 'Reinforced fatigues with knee patches.',
    slot: 'legs',
    hpBonus: 0, dr: 0, mobility: 1, tag: 'mundane',
    visual: { overlays: {
      legs: { svg: '/styles/flat/armor/basic/field_harness_legs.svg' },
    }},
  },

  // combat_plate (standard): hp 2 / dr 1 / mob 0
  combat_plate_helmet: {
    id: 'combat_plate_helmet',
    name: 'Combat Helmet',
    flavor: 'MICH-style shell with chinstrap and NVG mount.',
    slot: 'helmet',
    hpBonus: 0, dr: 0, mobility: 0, tag: 'mundane',
    visual: { overlays: {
      helmet: { svg: '/styles/flat/armor/basic/combat_plate_helmet.svg' },
    }},
  },
  combat_plate_shoulders: {
    id: 'combat_plate_shoulders',
    name: 'Combat Shoulder Pads',
    flavor: 'Soft nylon shoulder caps with unit patch.',
    slot: 'shoulders',
    hpBonus: 0, dr: 0, mobility: 0, tag: 'mundane',
    visual: { overlays: {
      'shoulder-l': { svg: '/styles/flat/armor/basic/combat_plate_shoulder.svg' },
      'shoulder-r': { svg: '/styles/flat/armor/basic/combat_plate_shoulder.svg' },
    }},
  },
  combat_plate_chest: {
    id: 'combat_plate_chest',
    name: 'Combat Plate Carrier',
    flavor: 'Plate carrier with chest plate, mag pouches, and radio.',
    slot: 'chest',
    hpBonus: 2, dr: 1, mobility: 0, tag: 'mundane',
    visual: { overlays: {
      torso: { svg: '/styles/flat/armor/basic/combat_plate_torso.svg' },
    }},
  },
  combat_plate_legs: {
    id: 'combat_plate_legs',
    name: 'Combat Trousers',
    flavor: 'Reinforced combat trousers with articulated knee plates.',
    slot: 'legs',
    hpBonus: 0, dr: 0, mobility: 0, tag: 'mundane',
    visual: { overlays: {
      legs: { svg: '/styles/flat/armor/basic/combat_plate_legs.svg' },
    }},
  },
  combat_plate_gauntlets: {
    id: 'combat_plate_gauntlets',
    name: 'Combat Bracers',
    flavor: 'Fingerless tactical gloves with forearm bracers.',
    slot: 'gauntlets',
    hpBonus: 0, dr: 0, mobility: 0, tag: 'mundane',
    visual: { overlays: {
      'gauntlet-front': { svg: '/styles/flat/armor/basic/combat_plate_gauntlets.svg' },
      'gauntlet-back': { svg: '/styles/flat/armor/basic/combat_plate_gauntlets.svg' },
    }},
  },

  // assault_plate (heavy): hp 4 / dr 2 / mob -1
  assault_plate_helmet: {
    id: 'assault_plate_helmet',
    name: 'Assault Helm',
    flavor: 'Closed combat helm with visor slit and neck drape.',
    slot: 'helmet',
    hpBonus: 1, dr: 0, mobility: 0, tag: 'mundane',
    visual: { overlays: {
      helmet: { svg: '/styles/flat/armor/basic/assault_plate_helmet.svg' },
    }},
  },
  assault_plate_shoulders: {
    id: 'assault_plate_shoulders',
    name: 'Assault Pauldrons',
    flavor: 'Heavy riveted pauldrons with layered armor scales.',
    slot: 'shoulders',
    hpBonus: 0, dr: 0, mobility: 0, tag: 'mundane',
    visual: { overlays: {
      'shoulder-l': { svg: '/styles/flat/armor/basic/assault_plate_shoulder.svg' },
      'shoulder-r': { svg: '/styles/flat/armor/basic/assault_plate_shoulder.svg' },
    }},
  },
  assault_plate_chest: {
    id: 'assault_plate_chest',
    name: 'Assault Plate Carrier',
    flavor: 'Hardshell chest scales with sternum rib and side rigs.',
    slot: 'chest',
    hpBonus: 2, dr: 1, mobility: -1, tag: 'mundane',
    visual: { overlays: {
      torso: { svg: '/styles/flat/armor/basic/assault_plate_torso.svg' },
    }},
  },
  assault_plate_legs: {
    id: 'assault_plate_legs',
    name: 'Assault Greaves',
    flavor: 'Full thigh cuisses, knee pauldrons, segmented shins, steel-toe boots.',
    slot: 'legs',
    hpBonus: 1, dr: 1, mobility: 0, tag: 'mundane',
    visual: { overlays: {
      legs: { svg: '/styles/flat/armor/basic/assault_plate_legs.svg' },
    }},
  },
  assault_plate_gauntlets: {
    id: 'assault_plate_gauntlets',
    name: 'Assault Gauntlets',
    flavor: 'Articulated plated bracers with armored knuckle gauntlets.',
    slot: 'gauntlets',
    hpBonus: 0, dr: 0, mobility: 0, tag: 'mundane',
    visual: { overlays: {
      'gauntlet-front': { svg: '/styles/flat/armor/basic/assault_plate_gauntlets.svg' },
      'gauntlet-back': { svg: '/styles/flat/armor/basic/assault_plate_gauntlets.svg' },
    }},
  },
};

export const ALL_ARMOR = Object.values(ARMOR);

import type { ContentPack } from '../../types';
import { WEAPONS } from './weapons';
import { ARMOR } from './armor';
import { UTILITIES } from './utilities';
import { KITS } from './kits';
import { MODS } from './mods';
import { SOLDIERS } from './soldiers';
import { ENEMIES } from './enemies';
import { ABILITIES } from './abilities';
import { ZONES, CONSUMABLES, INITIAL_STOCKPILE } from './zones';

/**
 * Eagle Corps vs. The Rust Choir — the ship-with pack. Desert-scout unit
 * (matte-black operators with the gold double-headed eagle) hunting a
 * scrap-cult of goblinoid raiders.
 *
 * The map's abstract spawn keys (`G`, `O`, `T`) bind to this faction's
 * goblin / orc / troll templates. Different packs can reuse the same maps
 * with different roster / enemy bindings.
 */
export const pack: ContentPack = {
  id: 'eagle-corps',
  name: 'Eagle Corps vs. The Rust Choir',
  description:
    "An elite desert scout unit deploys against a scavenger cult that wears its prey's metal.",

  soldierTemplates: SOLDIERS,
  defaultRoster: ['ranger_kestrel', 'warden_brannock', 'mystic_seraphine', 'sapper_orin'],

  enemyTemplates: ENEMIES,

  weapons: WEAPONS,
  armor: ARMOR,
  utilities: UTILITIES,
  kits: KITS,
  mods: MODS,
  abilities: ABILITIES,

  spawnLegend: {
    G: 'rust_goblin',
    O: 'rust_orc',
    T: 'rust_troll',
    B: 'rust_berserker',
  },

  playerFaction: { id: 'eagle-corps', name: 'Eagle Corps', sigilColor: '#e8c488' }, // gold
  enemyFaction:  { id: 'rust-choir',  name: 'The Rust Choir', sigilColor: '#c87030' }, // rust orange

  zones: ZONES,
  consumables: CONSUMABLES,
  initialStockpile: INITIAL_STOCKPILE,

  // Rig appearance catalogs — placeholder hair + outfit SVGs under
  // /styles/flat/human/. Drop-in replacement for the final art without
  // code change: the artist authors over these files with the same URLs.
  hairStyles: {
    short_crop: { id: 'short_crop', name: 'Short Crop', svg: '/styles/flat/human/hair_short_crop.svg' },
    bob:        { id: 'bob',        name: 'Bob',        svg: '/styles/flat/human/hair_bob.svg' },
    ponytail:   { id: 'ponytail',   name: 'Ponytail',   svg: '/styles/flat/human/hair_ponytail.svg' },
    bald:       { id: 'bald',       name: 'Bald',       svg: '/styles/flat/human/hair_bald.svg' },
  },
  baseOutfits: {
    fatigues: {
      id: 'fatigues', name: 'Field Fatigues',
      torsoSvg: '/styles/flat/human/outfit_fatigues_torso.svg',
      legsSvg:  '/styles/flat/human/outfit_fatigues_legs.svg',
    },
    robes: {
      id: 'robes', name: 'Robes',
      torsoSvg: '/styles/flat/human/outfit_robes_torso.svg',
      legsSvg:  '/styles/flat/human/outfit_robes_legs.svg',
    },
    utility: {
      id: 'utility', name: 'Utility Wear',
      torsoSvg: '/styles/flat/human/outfit_utility_torso.svg',
      legsSvg:  '/styles/flat/human/outfit_utility_legs.svg',
    },
  },

  theme: {
    /** Torso-only SVG (head + chest + legs; no arms). */
    spritePath: (templateId) => TORSOS[templateId],
    /** Arms SVG — rendered inside the weapon wrap so it tracks with the gun. */
    armsPath: (templateId) => ARMS_SVG[templateId],
    /** Weapon-layer SVG, rendered + rotated independently of the torso. */
    weaponPath: (templateId) => WEAPONS_SVG[templateId],
  },
};

const TORSOS: Record<string, string> = {
  ranger_kestrel:    '/styles/flat/soldier_torso.svg',
  warden_brannock:   '/styles/flat/soldier_warden_torso.svg',
  mystic_seraphine:  '/styles/flat/soldier_mystic_torso.svg',
  sapper_orin:       '/styles/flat/soldier_sapper_torso.svg',
  rust_goblin:       '/styles/flat/enemy_goblin_torso.svg',
  rust_orc:          '/styles/flat/enemy_orc_torso.svg',
  rust_troll:        '/styles/flat/enemy_troll_torso.svg',
  // Berserker uses the goblin silhouette — keeps scope tight; colour
  // tint sets him apart.
  rust_berserker:    '/styles/flat/enemy_goblin_torso.svg',
};

const ARMS_SVG: Record<string, string> = {
  ranger_kestrel:    '/styles/flat/soldier_arms.svg',
  warden_brannock:   '/styles/flat/soldier_warden_arms.svg',
  mystic_seraphine:  '/styles/flat/soldier_mystic_arms.svg',
  sapper_orin:       '/styles/flat/soldier_sapper_arms.svg',
  rust_goblin:       '/styles/flat/enemy_goblin_arms.svg',
  rust_orc:          '/styles/flat/enemy_orc_arms.svg',
  rust_troll:        '/styles/flat/enemy_troll_arms.svg',
  rust_berserker:    '/styles/flat/enemy_goblin_arms.svg',
};

const WEAPONS_SVG: Record<string, string> = {
  ranger_kestrel:    '/styles/flat/soldier_weapon.svg',
  warden_brannock:   '/styles/flat/soldier_warden_weapon.svg',
  mystic_seraphine:  '/styles/flat/soldier_mystic_weapon.svg',
  sapper_orin:       '/styles/flat/soldier_sapper_weapon.svg',
  rust_goblin:       '/styles/flat/enemy_goblin_weapon.svg',
  rust_orc:          '/styles/flat/enemy_orc_weapon.svg',
  rust_troll:        '/styles/flat/enemy_troll_weapon.svg',
  rust_berserker:    '/styles/flat/enemy_goblin_weapon.svg',
};

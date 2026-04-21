import type { ContentPack } from '../../types';
import { WEAPONS } from './weapons';
import { ARMOR } from './armor';
import { UTILITIES } from './utilities';
import { KITS } from './kits';
import { MODS } from './mods';
import { SOLDIERS } from './soldiers';
import { ENEMIES } from './enemies';
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

  spawnLegend: {
    G: 'rust_goblin',
    O: 'rust_orc',
    T: 'rust_troll',
  },

  playerFaction: { id: 'eagle-corps', name: 'Eagle Corps', sigilColor: '#e8c488' }, // gold
  enemyFaction:  { id: 'rust-choir',  name: 'The Rust Choir', sigilColor: '#c87030' }, // rust orange

  zones: ZONES,
  consumables: CONSUMABLES,
  initialStockpile: INITIAL_STOCKPILE,

  theme: {
    /** Body-layer SVG for a given templateId (under public/styles/flat). */
    spritePath: (templateId) => BODIES[templateId],
    /** Weapon-layer SVG, rendered + rotated independently of the body. */
    weaponPath: (templateId) => WEAPONS_SVG[templateId],
  },
};

const BODIES: Record<string, string> = {
  ranger_kestrel:    '/styles/flat/soldier_body.svg',
  warden_brannock:   '/styles/flat/soldier_warden_body.svg',
  mystic_seraphine:  '/styles/flat/soldier_mystic_body.svg',
  sapper_orin:       '/styles/flat/soldier_sapper_body.svg',
  rust_goblin:       '/styles/flat/enemy_goblin_body.svg',
  rust_orc:          '/styles/flat/enemy_orc_body.svg',
  rust_troll:        '/styles/flat/enemy_troll_body.svg',
};

const WEAPONS_SVG: Record<string, string> = {
  ranger_kestrel:    '/styles/flat/soldier_weapon.svg',
  warden_brannock:   '/styles/flat/soldier_warden_weapon.svg',
  mystic_seraphine:  '/styles/flat/soldier_mystic_weapon.svg',
  sapper_orin:       '/styles/flat/soldier_sapper_weapon.svg',
  rust_goblin:       '/styles/flat/enemy_goblin_weapon.svg',
  rust_orc:          '/styles/flat/enemy_orc_weapon.svg',
  rust_troll:        '/styles/flat/enemy_troll_weapon.svg',
};

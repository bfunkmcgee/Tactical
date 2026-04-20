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
};

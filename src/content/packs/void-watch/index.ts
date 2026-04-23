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
 * Void-Watch — a deliberately small validation pack. Two operatives boarding
 * a derelict generation ship to investigate signal anomalies; the only enemy
 * is a translucent shade. Sparse catalogs intentionally test the lower bound
 * of the ContentPack abstraction.
 *
 * Reuses engine-owned maps via spawnLegend rebinding — every map's G/O/T
 * spawn keys resolve to the single Hollow Wraith template here.
 */
export const pack: ContentPack = {
  id: 'void-watch',
  name: 'Void-Watch · Hollows of the Bulwark',
  description:
    'A two-operative boarding mission against translucent echoes haunting a derelict generation ship.',

  soldierTemplates: SOLDIERS,
  defaultRoster: ['vex_operator', 'kade_sentinel'],

  enemyTemplates: ENEMIES,

  weapons: WEAPONS,
  armor: ARMOR,
  utilities: UTILITIES,
  kits: KITS,
  mods: MODS,
  // Void-Watch's two operatives don't yet have signature abilities; an
  // empty registry validates the engine handles packs with zero abilities.
  abilities: {},

  // Minimal rig-appearance catalogs (Phase 6e). Void-Watch reuses the
  // shared /styles/flat/human/ placeholder assets; the operators' own
  // bespoke art is deferred pending a content sprint. Having these
  // catalogs present means Vex + Kade can ship `appearance` + go
  // through the single rig render path.
  hairStyles: {
    short_crop: { id: 'short_crop', name: 'Short Crop', svg: '/styles/flat/human/hair_short_crop.svg' },
    bob:        { id: 'bob',        name: 'Bob',        svg: '/styles/flat/human/hair_bob.svg' },
    ponytail:   { id: 'ponytail',   name: 'Ponytail',   svg: '/styles/flat/human/hair_ponytail.svg' },
    bald:       { id: 'bald',       name: 'Bald',       svg: '/styles/flat/human/hair_bald.svg' },
  },
  baseOutfits: {
    fatigues: { id: 'fatigues', name: 'Void Fatigues',
                torsoSvg: '/styles/flat/human/outfit_fatigues_torso.svg',
                legsSvg:  '/styles/flat/human/outfit_fatigues_legs.svg' },
    utility:  { id: 'utility',  name: 'Boarding Rig',
                torsoSvg: '/styles/flat/human/outfit_utility_torso.svg',
                legsSvg:  '/styles/flat/human/outfit_utility_legs.svg' },
  },

  spawnLegend: {
    G: 'hollow_wraith',
    O: 'hollow_wraith',
    T: 'hollow_wraith',
  },

  playerFaction: { id: 'void-watch', name: 'Void-Watch', sigilColor: '#9bd4ff' },
  enemyFaction:  { id: 'the-hollow', name: 'The Hollow', sigilColor: '#7a8fb0' },

  zones: ZONES,
  consumables: CONSUMABLES,
  initialStockpile: INITIAL_STOCKPILE,
};

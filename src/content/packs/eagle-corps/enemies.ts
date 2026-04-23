import type { EnemyTemplate } from '../../../game/types';

/**
 * The Rust Choir — a scavenger cult of goblinoid raiders clad in welded scrap.
 * Goblins form the backbone of every band; orcs lead squads; trolls are rare
 * war-priests heralded by the clang of their massive bells.
 *
 * Phase 6e migration: every enemy now routes through the rig renderer
 * via `appearance.partOverrides`. The bespoke enemy torso + arms SVGs
 * (authored at the shared 96×128 rig frame) map directly onto the rig's
 * 'torso' + 'arms-front' slots; the remaining parts (legs / head /
 * arms-back) use a transparent placeholder so the shared human-rig
 * fallback art doesn't bleed through the bespoke silhouette.
 *
 * skinTone is identity (0xffffff) by default — the bespoke SVGs carry
 * baked art with their own colours; tinting through skinTone would
 * double-darken them. Hair + baseOutfit are omitted (both optional on
 * HumanAppearance) since the bespoke torso already contains whatever
 * headgear / clothing the creature wears.
 */
const TRANSPARENT = '/styles/flat/human/rig_transparent.svg';
const enemyOverrides = (torsoSvg: string, armsSvg: string) => ({
  legs: TRANSPARENT,
  'arms-back': TRANSPARENT,
  torso: torsoSvg,
  head: TRANSPARENT,
  'arms-front': armsSvg,
});

export const ENEMIES: Record<string, EnemyTemplate> = {
  rust_goblin: {
    id: 'rust_goblin',
    name: 'Rust Goblin',
    hpMax: 5,
    aim: 55,
    mobility: 4,
    dmgMin: 2, dmgMax: 4,
    rangeShort: 5, rangeLong: 10,
    kind: 'ranged',
    color: '#9aa054', // sickly yellow-green
    fireClass: 'shotgun', // short-barrel scrap blunderbuss — wide cone blast.
    appearance: {
      rig: 'human',
      skinTone: 0xffffff,
      partOverrides: enemyOverrides(
        '/styles/flat/enemy_goblin_torso.svg',
        '/styles/flat/enemy_goblin_arms.svg',
      ),
    },
  },
  rust_orc: {
    id: 'rust_orc',
    name: 'Rust Orc',
    hpMax: 12,
    aim: 60,
    mobility: 3,
    dmgMin: 4, dmgMax: 6,
    rangeShort: 6, rangeLong: 12,
    kind: 'ranged',
    color: '#6a7048', // deeper moss green
    fireClass: 'rifle', // scrap assault rifle — single shouldered shot.
    // Orcs carry a crude satchel-bomb. When the AI sees two or more
    // squad members huddled in the same 2-tile ring, it lobs it.
    grenade: { dmgMin: 3, dmgMax: 5, radius: 2, range: 6 },
    appearance: {
      rig: 'human',
      skinTone: 0xffffff,
      partOverrides: enemyOverrides(
        '/styles/flat/enemy_orc_torso.svg',
        '/styles/flat/enemy_orc_arms.svg',
      ),
    },
  },
  rust_troll: {
    id: 'rust_troll',
    name: 'Rust Troll',
    hpMax: 22,
    aim: 55,
    mobility: 3,
    dmgMin: 6, dmgMax: 9,
    rangeShort: 7, rangeLong: 14,
    kind: 'ranged',
    color: '#7a6a50', // gray-brown hide
    fireClass: 'heavy',
    burstShots: 4, // scrap MG rips a 4-round burst; each round rolled separately.
    appearance: {
      rig: 'human',
      skinTone: 0xffffff,
      partOverrides: enemyOverrides(
        '/styles/flat/enemy_troll_torso.svg',
        '/styles/flat/enemy_troll_arms.svg',
      ),
    },
  },
  rust_berserker: {
    id: 'rust_berserker',
    name: 'Rust Berserker',
    hpMax: 9,
    aim: 70,           // melee — very reliable at point-blank.
    mobility: 5,       // fast charger closes distance in one turn across most maps.
    dmgMin: 6, dmgMax: 10,
    rangeShort: 1, rangeLong: 1,  // adjacent strike only.
    kind: 'melee',
    color: '#a03818',  // burnt-orange rage paint.
    fireClass: 'pistol',   // short single-swing animation; no burst.
    // Berserkers reuse the goblin silhouette (same as the legacy bespoke
    // theme); a warm red-orange skinTone wash pushes the goblin green
    // toward rage-paint. Dedicated berserker art can land in a content
    // sprint without touching the engine.
    appearance: {
      rig: 'human',
      skinTone: 0xffa888,
      partOverrides: enemyOverrides(
        '/styles/flat/enemy_goblin_torso.svg',
        '/styles/flat/enemy_goblin_arms.svg',
      ),
    },
  },
};

import type { EnemyTemplate } from '../../../game/types';

/**
 * The Rust Choir — a scavenger cult of goblinoid raiders clad in welded scrap.
 * Goblins form the backbone of every band; orcs lead squads; trolls are rare
 * war-priests heralded by the clang of their massive bells.
 *
 * Every enemy routes through the rig renderer via `appearance.partOverrides`.
 * Pre-6e the bespoke SVGs were monolithic (`enemy_goblin_torso.svg` + a
 * paired `_arms.svg` that also contained the head + helmet); post follow-up,
 * each enemy now ships a proper 4-part split (`legs`, `torso`, `head`,
 * `arms-front`) under `public/styles/flat/enemies/<name>/`. The
 * arms-back slot stays transparent (the part override points at
 * rig_transparent.svg) — these creatures fire from the front, so each
 * appearance sets `armsBackHidden: true` to tell the renderer to suppress
 * the "back arm sway" channel (there's no art to carry it).
 * Per-part animation (legs squash on foot-plant, torso lean, head
 * counter-lean, weapon aim rotating only the arms) now works on
 * enemies exactly the way it does on heroes.
 *
 * skinTone is identity (0xffffff) by default — the bespoke SVGs carry
 * baked art with their own colours; tinting through skinTone would
 * double-darken them. Hair + baseOutfit are omitted (both optional on
 * HumanAppearance) since the bespoke art already contains whatever
 * headgear / clothing the creature wears.
 */
const TRANSPARENT = '/styles/flat/human/rig_transparent.svg';
const enemyOverrides = (dir: string, prefix: string) => ({
  legs:         `/styles/flat/enemies/${dir}/${prefix}_legs.svg`,
  'arms-back':  TRANSPARENT,
  torso:        `/styles/flat/enemies/${dir}/${prefix}_torso.svg`,
  head:         `/styles/flat/enemies/${dir}/${prefix}_head.svg`,
  'arms-front': `/styles/flat/enemies/${dir}/${prefix}_arms_front.svg`,
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
    archetype: 'flanker', // skirmisher; nudges around walls to break the squad's cover
    posture: 'hunched',
    appearance: {
      rig: 'human',
      skinTone: 0xffffff,
      partOverrides: enemyOverrides('goblin', 'goblin'),
      armsBackHidden: true,
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
    // Orcs carry a crude satchel-bomb. The 'grenadier' archetype
    // lowers the throw threshold to 1 caught player, so an isolated
    // hero is fair game — no need to wait for a cluster.
    grenade: { dmgMin: 3, dmgMax: 5, radius: 2, range: 6 },
    archetype: 'grenadier',
    posture: 'hunched',
    appearance: {
      rig: 'human',
      skinTone: 0xffffff,
      partOverrides: enemyOverrides('orc', 'orc'),
      armsBackHidden: true,
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
    archetype: 'sniper', // long-sightline anchor; overwatches mid-range, refuses to advance into the open
    posture: 'upright',
    appearance: {
      rig: 'human',
      skinTone: 0xffffff,
      partOverrides: enemyOverrides('troll', 'troll'),
      armsBackHidden: true,
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
    archetype: 'berserker', // ignores cover bias when picking move tiles — sprints to the squad
    posture: 'hunched',
    // Berserkers reuse the goblin silhouette (same as the legacy bespoke
    // theme); a warm red-orange skinTone wash pushes the goblin green
    // toward rage-paint. Dedicated berserker art can land in a content
    // sprint without touching the engine.
    appearance: {
      rig: 'human',
      skinTone: 0xffa888,
      partOverrides: enemyOverrides('goblin', 'goblin'),
      armsBackHidden: true,
    },
  },
};

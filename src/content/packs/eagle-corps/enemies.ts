import type { EnemyTemplate } from '../../../game/types';

/**
 * The Rust Choir — a scavenger cult of goblinoid raiders clad in welded scrap.
 * Goblins form the backbone of every band; orcs lead squads; trolls are rare
 * war-priests heralded by the clang of their massive bells.
 */
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
  },
};

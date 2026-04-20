import type { WeaponMod } from '../../../game/types';

/** Sparse Void-Watch mod catalog — 4 mods, one per slot. */
export const MODS: Record<string, WeaponMod> = {
  optic_targeting_computer: {
    id: 'optic_targeting_computer',
    name: 'Targeting Computer',
    flavor: 'Suit-linked target tracker that paints a moving dot in your visor.',
    slot: 'optic',
    fits: ['rifle', 'sniper', 'pistol'],
    effects: { aim: 10 },
    tag: 'runic',
  },
  mag_high_density_cell: {
    id: 'mag_high_density_cell',
    name: 'High-Density Cell',
    flavor: 'Compressed power cell. More shots, more weight.',
    slot: 'magazine',
    fits: ['rifle', 'sniper'],
    effects: { ammo: 2, mobility: -1 },
    tag: 'runic',
  },
  muzzle_coil_booster: {
    id: 'muzzle_coil_booster',
    name: 'Coil Booster',
    flavor: 'Adds a parallel acceleration coil. Hotter rounds, hotter barrels.',
    slot: 'muzzle',
    fits: ['rifle', 'sniper', 'pistol'],
    effects: { dmgMax: 1, crit: 5 },
    tag: 'runic',
  },
  stock_stabilizer: {
    id: 'stock_stabilizer',
    name: 'Stabilizer',
    flavor: 'Gyroscopic stock that bleeds off recoil. Steadier in zero-G too.',
    slot: 'stock',
    fits: ['rifle', 'sniper'],
    effects: { aim: 5 },
    tag: 'mundane',
  },
};

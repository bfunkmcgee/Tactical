import type { WeaponMod } from '../types';

/**
 * Phase-2 weapon modifications. A mod fits a slot if its `slot` matches and
 * its `fits[]` includes the weapon's class. Effects are summed onto the base
 * weapon by `engine/loadout.ts:resolveWeapon`.
 */
export const MODS: Record<string, WeaponMod> = {
  // ---- OPTIC ----
  optic_reflex: {
    id: 'optic_reflex',
    name: 'Tactical Reflex',
    flavor: 'A holographic sigil floats in the eyepiece; quick targets snap into focus.',
    slot: 'optic',
    fits: ['rifle', 'smg', 'shotgun', 'pistol'],
    effects: { aim: 5 },
    tag: 'mundane',
  },
  optic_marksman_scope: {
    id: 'optic_marksman_scope',
    name: 'Marksman Scope',
    flavor: 'A long-tube optic banded with focusing runes. Punishes distance.',
    slot: 'optic',
    fits: ['rifle', 'sniper'],
    effects: { aim: 15, flags: ['no_range_falloff'] },
    tag: 'runic',
  },
  optic_thermal_hud: {
    id: 'optic_thermal_hud',
    name: 'Thermal HUD',
    flavor: 'Alchemical lenses pierce the densest mist. Smoke is no shelter.',
    slot: 'optic',
    fits: ['rifle', 'sniper', 'smg', 'pistol'],
    effects: { aim: 5, flags: ['thermal'] },
    tag: 'alchemical',
  },
  optic_targeting_sigil: {
    id: 'optic_targeting_sigil',
    name: 'Targeting Sigil',
    flavor: 'A fae glyph that whispers weak points. Crit chances bloom.',
    slot: 'optic',
    fits: ['rifle', 'sniper', 'smg', 'shotgun', 'pistol', 'heavy'],
    effects: { crit: 10 },
    tag: 'fae',
  },

  // ---- MAGAZINE ----
  mag_extended: {
    id: 'mag_extended',
    name: 'Extended Mag',
    flavor: 'Twice the rounds, twice the weight. Worth it on long deployments.',
    slot: 'magazine',
    fits: ['rifle', 'smg', 'shotgun', 'heavy'],
    effects: { ammo: 2, mobility: -1 },
    tag: 'mundane',
  },
  mag_drum: {
    id: 'mag_drum',
    name: 'Drum Mag',
    flavor: 'A cylindrical scrap-fed drum. Pours rounds; ruins aim.',
    slot: 'magazine',
    fits: ['rifle', 'smg', 'heavy'],
    effects: { ammo: 4, aim: -10 },
    tag: 'mundane',
  },
  mag_sigil_rounds: {
    id: 'mag_sigil_rounds',
    name: 'Sigil Rounds',
    flavor: 'Etched sapphire-tipped cartridges that hum on flight.',
    slot: 'magazine',
    fits: ['rifle', 'sniper', 'smg', 'shotgun', 'pistol', 'heavy'],
    effects: { dmgMin: 1, dmgMax: 1 },
    tag: 'runic',
  },
  mag_piercing: {
    id: 'mag_piercing',
    name: 'Piercing Rounds',
    flavor: 'Solid draconic-iron slugs. Less crush, more punch through plate.',
    slot: 'magazine',
    fits: ['rifle', 'sniper', 'pistol', 'heavy'],
    effects: { dmgMin: -1, dmgMax: -1, flags: ['piercing'] },
    tag: 'draconic',
  },

  // ---- MUZZLE ----
  muzzle_suppressor: {
    id: 'muzzle_suppressor',
    name: 'Suppressor',
    flavor: 'Sigil-baffled shroud. Quietens the round and steadies the bore.',
    slot: 'muzzle',
    fits: ['rifle', 'smg', 'pistol', 'sniper'],
    effects: { dmgMin: -1, dmgMax: -1, flags: ['no_range_falloff'] },
    tag: 'mundane',
  },
  muzzle_compensator: {
    id: 'muzzle_compensator',
    name: 'Compensator',
    flavor: 'Vented brake. Tames the recoil; rewards a held breath with crits.',
    slot: 'muzzle',
    fits: ['rifle', 'smg', 'shotgun', 'pistol', 'heavy'],
    effects: { crit: 5 },
    tag: 'mundane',
  },
  muzzle_rune_catalyzer: {
    id: 'muzzle_rune_catalyzer',
    name: 'Rune Catalyzer',
    flavor: 'A barrel band etched with draconic glyphs. Each shot leaves an ember.',
    slot: 'muzzle',
    fits: ['rifle', 'sniper', 'smg', 'shotgun', 'pistol', 'heavy'],
    effects: { dmgMax: 1, crit: 5 },
    tag: 'draconic',
  },

  // ---- STOCK ----
  stock_folding: {
    id: 'stock_folding',
    name: 'Folding Stock',
    flavor: 'Hinged stock that snaps flat for sprints. Costs accuracy.',
    slot: 'stock',
    fits: ['rifle', 'smg'],
    effects: { mobility: 1, aim: -5 },
    tag: 'mundane',
  },
  stock_heavy: {
    id: 'stock_heavy',
    name: 'Heavy Stock',
    flavor: 'Counterweighted plate. Steadies the long shot at the cost of speed.',
    slot: 'stock',
    fits: ['rifle', 'sniper', 'shotgun', 'heavy'],
    effects: { aim: 5, mobility: -1 },
    tag: 'mundane',
  },
  stock_reactive_grip: {
    id: 'stock_reactive_grip',
    name: 'Reactive Grip',
    flavor: 'Fae-haptic grip that hums on a clean shot. Sometimes spits the round back into the magazine.',
    slot: 'stock',
    fits: ['rifle', 'sniper', 'smg', 'shotgun', 'heavy'],
    effects: { flags: ['recover_ammo_on_crit'] },
    tag: 'fae',
  },
};

export const ALL_MODS = Object.values(MODS);

/** All mods that fit a given weapon class + slot. */
export function modsFor(slot: import('../types').ModSlot, weaponClass: import('../types').WeaponClass): WeaponMod[] {
  return ALL_MODS.filter((m) => m.slot === slot && m.fits.includes(weaponClass));
}

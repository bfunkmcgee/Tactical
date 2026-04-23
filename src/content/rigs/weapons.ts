import type { ModSlot, WeaponClass } from '../../game/types';

/**
 * Anchor offsets (in the weapon SVG's unscaled 96×128 frame) where a
 * mod attachment sprite mounts. Coordinates are pixels from the weapon
 * sprite's top-left — NOT relative to the grip anchor. Mod SVGs should
 * be authored so their (0,0) aligns with the anchor below.
 *
 * Phase 6c — initial coverage is per-weapon-class rifle / shotgun /
 * sniper / smg / pistol / heavy, with the common four mod slots. Some
 * weapons don't have every slot (e.g. sidearms lack 'magazine' +
 * 'stock'); unset anchors default to (0,0) which places the attachment
 * at the weapon's origin — visually noticeable so authors notice the
 * miss and file an anchor entry.
 */
export const WEAPON_ANCHORS: Record<WeaponClass, Partial<Record<ModSlot, { x: number; y: number }>>> = {
  rifle: {
    optic:    { x: 30, y: 32 },
    magazine: { x: 40, y: 60 },
    muzzle:   { x: 80, y: 48 },
    stock:    { x:  2, y: 50 },
  },
  smg: {
    optic:    { x: 32, y: 36 },
    magazine: { x: 40, y: 66 },
    muzzle:   { x: 72, y: 50 },
    stock:    { x:  4, y: 52 },
  },
  shotgun: {
    optic:    { x: 30, y: 30 },
    magazine: { x: 36, y: 62 },
    muzzle:   { x: 78, y: 48 },
    stock:    { x:  2, y: 52 },
  },
  sniper: {
    optic:    { x: 36, y: 24 },
    magazine: { x: 40, y: 60 },
    muzzle:   { x: 84, y: 48 },
    stock:    { x:  0, y: 50 },
  },
  pistol: {
    optic:    { x: 30, y: 40 },
    muzzle:   { x: 62, y: 52 },
  },
  heavy: {
    optic:    { x: 30, y: 28 },
    magazine: { x: 40, y: 60 },
    muzzle:   { x: 82, y: 48 },
    stock:    { x:  0, y: 48 },
  },
};

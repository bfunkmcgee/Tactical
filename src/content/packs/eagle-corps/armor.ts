import type { Armor } from '../../../game/types';

/**
 * Eagle Corps armor entries. As of Phase 5b each one carries a `visual`
 * block that ports the existing per-class bespoke torso/arms SVGs into
 * rig-overlay slots. A rig-composed Ranger in a mithril vest renders as
 * Kestrel's signature silhouette; the same armor overlay on a different
 * appearance looks like that character wearing the same gear.
 *
 * The legacy per-soldier bespoke SVGs (`soldier_torso.svg` etc.) stay in
 * the repo — they're still referenced via `pack.theme.spritePath` for
 * any template that doesn't carry `appearance`. The overlay URLs below
 * ALIAS those same files; we're re-using, not duplicating.
 */
export const ARMOR: Record<string, Armor> = {
  warded_plate: {
    id: 'warded_plate',
    name: 'Warded Plate Carrier',
    flavor: 'Heavy ceramic plates bound with warding runes; stops most things.',
    hpBonus: 4, dr: 2, mobility: -1,
    tag: 'runic',
    visual: {
      torsoOverlay: '/styles/flat/soldier_warden_torso.svg',
      gauntletsFront: '/styles/flat/soldier_warden_arms.svg',
      legsOverlay: '/styles/flat/armor_legs/warded_plate_legs.svg',
    },
  },
  mithril_vest: {
    id: 'mithril_vest',
    name: 'Mithril-Laced Vest',
    flavor: 'A weave of mithril mesh beneath a standard combat vest.',
    hpBonus: 2, dr: 1, mobility: 0,
    tag: 'mundane',
    visual: {
      // Base Ranger (Kestrel) torso = the original monolithic soldier.svg silhouette.
      torsoOverlay: '/styles/flat/soldier_torso.svg',
      gauntletsFront: '/styles/flat/soldier_arms.svg',
      legsOverlay: '/styles/flat/armor_legs/mithril_vest_legs.svg',
    },
  },
  swiftstep_greaves: {
    id: 'swiftstep_greaves',
    name: 'Swiftstep Greaves',
    flavor: 'Light leg armor with elvenstep charms for extra pace.',
    hpBonus: 1, dr: 0, mobility: 1,
    tag: 'fae',
    visual: {
      torsoOverlay: '/styles/flat/soldier_mystic_torso.svg',
      gauntletsFront: '/styles/flat/soldier_mystic_arms.svg',
      legsOverlay: '/styles/flat/armor_legs/swiftstep_greaves_legs.svg',
    },
  },
  oakheart_helm: {
    id: 'oakheart_helm',
    name: 'Oakheart Helm',
    flavor: 'Kevlar shell reinforced with heartwood; quiet and tough.',
    hpBonus: 3, dr: 1, mobility: 0,
    tag: 'alchemical',
    visual: {
      torsoOverlay: '/styles/flat/soldier_sapper_torso.svg',
      gauntletsFront: '/styles/flat/soldier_sapper_arms.svg',
      legsOverlay: '/styles/flat/armor_legs/oakheart_helm_legs.svg',
    },
  },
};

export const ALL_ARMOR = Object.values(ARMOR);

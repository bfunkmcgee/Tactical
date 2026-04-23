import type { Kit } from '../../../game/types';

/**
 * Phase-1 Kit catalog — passive equipment in a single slot.
 * Effects fold into the soldier at unit spawn time.
 */
export const KITS: Record<string, Kit> = {
  salvagers_webbing: {
    id: 'salvagers_webbing',
    name: "Salvager's Webbing",
    flavor: 'Stripped-pocket vest favoured by long-range scouts. Carries the spare rounds nobody wants to think about.',
    effects: { extraAmmoPrimary: 2, extraAmmoSidearm: 1 },
    tag: 'mundane',
    visual: { overlays: {
      belt: { svg: '/styles/flat/kit_visuals/salvagers_webbing.svg' },
    }},
  },
  whisperstep_boots: {
    id: 'whisperstep_boots',
    name: 'Whisperstep Boots',
    flavor: 'Light desert boots worked through with elvenstep charms. The footfalls hush against sand and stone.',
    effects: { mobilityBonus: 1 },
    tag: 'fae',
  },
  warden_plate: {
    id: 'warden_plate',
    name: "Warden's Underplate",
    flavor: 'A lacquered ceramic plate worn under the chest rig. Heavy, but it has stopped a Hexbore round more than once.',
    effects: { hpBonus: 3 },
    tag: 'runic',
  },
  spotters_lens: {
    id: 'spotters_lens',
    name: "Spotter's Lens",
    flavor: 'A sigil-etched monocle sized to the dominant eye. Steadies the aim no matter what the rest of the body is doing.',
    effects: { aimBonus: 5 },
    tag: 'runic',
  },
  alchemists_satchel: {
    id: 'alchemists_satchel',
    name: "Alchemist's Satchel",
    flavor: 'Leather-bound satchel of vials, fuses, and spare reagents. Every utility carries an extra charge.',
    effects: { extraUtilityCharges: 1 },
    tag: 'alchemical',
  },
  ember_focus: {
    id: 'ember_focus',
    name: 'Ember Focus',
    flavor: 'A draconic focus crystal worn at the throat. Steadies the breath; lengthens the magazine.',
    effects: { extraAmmoPrimary: 3, hpBonus: -1 },
    tag: 'draconic',
  },
};

export const ALL_KITS = Object.values(KITS);

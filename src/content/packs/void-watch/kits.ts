import type { Kit } from '../../../game/types';

export const KITS: Record<string, Kit> = {
  marksman_rig: {
    id: 'marksman_rig',
    name: 'Marksman Rig',
    flavor: 'Stabilising harness for the dominant arm. Tightens the bead at distance.',
    effects: { aimBonus: 5 },
    tag: 'runic',
  },
  hardpoint_webbing: {
    id: 'hardpoint_webbing',
    name: 'Hardpoint Webbing',
    flavor: 'Magnetised mag pouches. Carries an extra spare for the long deployments.',
    effects: { extraAmmoPrimary: 2 },
    tag: 'mundane',
  },
  reinforced_boots: {
    id: 'reinforced_boots',
    name: 'Reinforced Boots',
    flavor: 'Mag-grip soles. Fast across deck plating, terrible on rough rock.',
    effects: { mobilityBonus: 1 },
    tag: 'mundane',
  },
};

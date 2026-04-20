import type { Utility } from '../../../game/types';

export const UTILITIES: Record<string, Utility> = {
  plasma_charge: {
    id: 'plasma_charge',
    name: 'Plasma Charge',
    flavor: 'Magnetised charge that detonates in a contained plasma sphere.',
    kind: 'grenade',
    charges: 2, radius: 2, range: 6,
    dmgMin: 4, dmgMax: 6, apCost: 1,
    tag: 'runic',
  },
  stim_patch: {
    id: 'stim_patch',
    name: 'Stim Patch',
    flavor: 'Auto-injecting derm patch. Closes wounds the suit cannot.',
    kind: 'medkit',
    charges: 2, radius: 0, range: 1, heal: 5, apCost: 1,
    tag: 'mundane',
  },
};

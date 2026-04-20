import type { Weapon } from '../../../game/types';

/**
 * Void-Watch sidearms and primaries — sparse on purpose to test how a
 * minimal pack feels in the LoadoutScreen.
 */
export const WEAPONS: Record<string, Weapon> = {
  pulse_rifle: {
    id: 'pulse_rifle',
    name: 'Pulse Rifle',
    flavor: 'Standard-issue induction rifle. Three-round bursts of accelerated plasma.',
    class: 'rifle',
    slot: 'primary',
    dmgMin: 4, dmgMax: 6, aim: 5, crit: 10,
    rangeShort: 7, rangeLong: 14, ammo: 5, apCost: 1,
    tag: 'runic',
  },
  mag_lance: {
    id: 'mag_lance',
    name: 'Mag-Lance',
    flavor: 'Linear accelerator long-rifle. One round, one corridor, one kill.',
    class: 'sniper',
    slot: 'primary',
    dmgMin: 7, dmgMax: 10, aim: -5, crit: 30,
    rangeShort: 12, rangeLong: 22, ammo: 2, apCost: 2,
    endsTurn: true,
    tag: 'runic',
  },
  service_pistol: {
    id: 'service_pistol',
    name: 'Service Pistol',
    flavor: 'Polymer-frame sidearm. Reliable. Loud.',
    class: 'pistol',
    slot: 'sidearm',
    dmgMin: 2, dmgMax: 4, aim: 5, crit: 10,
    rangeShort: 5, rangeLong: 10, ammo: 4, apCost: 1,
    tag: 'mundane',
  },
  shock_baton: {
    id: 'shock_baton',
    name: 'Shock Baton',
    flavor: 'Boarding-action close-quarters baton with a cell-charged tip.',
    class: 'pistol',
    slot: 'sidearm',
    dmgMin: 3, dmgMax: 5, aim: 0, crit: 20,
    rangeShort: 1, rangeLong: 2, ammo: 99, apCost: 1,
    tag: 'runic',
  },
};

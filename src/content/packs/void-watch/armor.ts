import type { Armor } from '../../../game/types';

/**
 * Void-Watch armor — per-slot pieces (Phase 6a). Legacy monoliths
 * `suit_lining` and `eva_plate` decompose into chest + legs pieces
 * (EVA plate) or just chest (suit lining). Visual slots stay empty
 * pending authored rig overlays — stat-only entries still function.
 */
export const ARMOR: Record<string, Armor> = {
  suit_lining_chest: {
    id: 'suit_lining_chest',
    name: 'Suit Lining',
    flavor: 'Pressurised undersuit. Soft, light, almost no protection.',
    slot: 'chest',
    hpBonus: 1, dr: 0, mobility: 1, tag: 'mundane',
  },
  eva_plate_chest: {
    id: 'eva_plate_chest',
    name: 'EVA Plate Carrier',
    flavor: 'Vacuum-rated boarding plate. Heavy, but it shrugs off plasma scoring.',
    slot: 'chest',
    hpBonus: 2, dr: 1, mobility: -1, tag: 'mundane',
  },
  eva_plate_legs: {
    id: 'eva_plate_legs',
    name: 'EVA Plate Greaves',
    flavor: 'Matching leg plates — slow, but full coverage.',
    slot: 'legs',
    hpBonus: 2, dr: 1, mobility: 0, tag: 'mundane',
  },
};

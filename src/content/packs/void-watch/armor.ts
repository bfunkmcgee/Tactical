import type { Armor } from '../../../game/types';

export const ARMOR: Record<string, Armor> = {
  suit_lining: {
    id: 'suit_lining',
    name: 'Suit Lining',
    flavor: 'Pressurised undersuit. Soft, light, almost no protection.',
    hpBonus: 1, dr: 0, mobility: 1,
    tag: 'mundane',
  },
  eva_plate: {
    id: 'eva_plate',
    name: 'EVA Plate',
    flavor: 'Vacuum-rated boarding plate. Heavy, but it shrugs off plasma scoring.',
    hpBonus: 4, dr: 2, mobility: -1,
    tag: 'mundane',
  },
};

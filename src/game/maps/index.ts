import type { GridMap } from '../types';
import { RUINED_MARKET } from './ruined_market';
import { RUST_CHAPEL } from './rust_chapel';

export { RUINED_MARKET, RUST_CHAPEL };

/** All engine-owned maps available for random mission selection. */
export const ALL_MAPS: GridMap[] = [RUINED_MARKET, RUST_CHAPEL];

/** Pick a map uniformly at random from the pool. */
export function pickRandomMap(): GridMap {
  return ALL_MAPS[Math.floor(Math.random() * ALL_MAPS.length)];
}

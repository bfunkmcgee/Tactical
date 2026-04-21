import type { GridMap } from '../types';
import { RUINED_MARKET } from './ruined_market';
import { RUST_CHAPEL } from './rust_chapel';
import { SIGNAL_RELAY } from './signal_relay';
import { DRY_WELL } from './dry_well';
import { GATE_WATCH } from './gate_watch';
import { DESERT_REFINERY } from './desert_refinery';
import { validateMapReachability } from './validate';

export { RUINED_MARKET, RUST_CHAPEL, SIGNAL_RELAY, DRY_WELL, GATE_WATCH, DESERT_REFINERY };
export { validateMapReachability } from './validate';

/** All engine-owned maps available for random mission selection. */
export const ALL_MAPS: GridMap[] = [
  RUINED_MARKET, RUST_CHAPEL,
  SIGNAL_RELAY, DRY_WELL, GATE_WATCH, DESERT_REFINERY,
];

// Validate at module load. Any unreachable enemy spawn is a content bug —
// the mission would be unwinnable — so we surface it loudly in the console.
for (const m of ALL_MAPS) {
  for (const w of validateMapReachability(m)) console.warn(w);
}

/** Pick a map uniformly at random from the pool. */
export function pickRandomMap(): GridMap {
  return ALL_MAPS[Math.floor(Math.random() * ALL_MAPS.length)];
}

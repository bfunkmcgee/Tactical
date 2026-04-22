import type { Graphics } from 'pixi.js';
import type { GridMap, Vec2 } from '../../types';
import { tileAt } from '../../engine/grid';
import { gridToScreen } from '../isoProjection';
import { biomeFor } from '../biomes';

/**
 * Scatter biome-appropriate props across ~8% of plain-floor tiles.
 * Deterministic by tile hash so the layout holds still across
 * redraws. Spawn tiles (both factions) stay empty so nothing hides
 * under a unit at mission start; cover tiles skip too — the prop
 * would clash with the raised cover silhouette.
 */
export function drawEnvProps(g: Graphics, map: GridMap) {
  const props = biomeFor(map.tileset).propPool;
  if (props.length === 0) return;
  // Exclude spawn tiles AND their chebyshev-1 neighbours. This gives
  // every soldier a clean "stepping-out" zone at mission start — the
  // first screenshot had bones scattered on the exact tiles where
  // player units needed to move.
  const bufferKeys = new Set<number>();
  const addBuffer = (px: number, py: number) => {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        bufferKeys.add((py + dy) * 4096 + (px + dx));
      }
    }
  };
  const allSpawns: Vec2[] = [
    ...map.playerSpawns,
    ...map.enemySpawns.map((e) => e.pos),
  ];
  for (const p of allSpawns) addBuffer(p.x, p.y);

  // Visual density gradient: sparse near spawns / clean near the
  // edges, denser in the contested mid-map. Produces a visual
  // rhythm where the eye finds dense focal zones and clean
  // movement lanes.
  const cx = map.width / 2, cy = map.height / 2;
  const maxDistToCentre = Math.hypot(cx, cy);
  function densityAt(x: number, y: number): number {
    // Distance to nearest spawn (low near spawns → low density).
    let nearest = Infinity;
    for (const s of allSpawns) {
      const d = Math.max(Math.abs(s.x - x), Math.abs(s.y - y));
      if (d < nearest) nearest = d;
    }
    const spawnFactor = Math.min(1, nearest / 6);
    // Distance from centre normalised (high at centre → high density).
    const centreDist = Math.hypot(x - cx, y - cy);
    const centreFactor = 1 - Math.min(1, centreDist / maxDistToCentre);
    // Blend: 20% base everywhere, 0–20% more when near-centre, 0–15%
    // more when far from spawns. Caps at 25% to avoid noise.
    const base = 4;
    const pct = base + spawnFactor * 15 + centreFactor * 6;
    return Math.min(25, pct);
  }

  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const t = tileAt(map, x, y);
      if (!t || t.kind !== 'floor') continue;
      if (bufferKeys.has(y * 4096 + x)) continue;
      const h = (x * 73856093 ^ y * 19349663) >>> 0;
      const threshold = densityAt(x, y);
      if ((h % 100) >= threshold) continue;
      const pickIdx = ((h >>> 8) % props.length) | 0;
      // Wider jitter (±5 x, ±3 y) so adjacent props don't look
      // grid-aligned on a screenshot.
      const jx = ((h >>> 12) % 11) - 5;
      const jy = ((h >>> 17) % 7) - 3;
      const p = gridToScreen({ x, y });
      props[pickIdx](g, p.x + jx, p.y + jy);
    }
  }
}

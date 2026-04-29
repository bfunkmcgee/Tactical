import type { Graphics } from 'pixi.js';
import type { GridMap, Vec2 } from '../../types';
import { tileAt } from '../../engine/grid';
import { gridToScreen } from '../isoProjection';
import { biomeFor } from '../biomes';

/**
 * Floor-decal second pass — smaller, denser marks than env props. The
 * density bias is strongest along "combat lanes" (straight line from
 * each player spawn to its nearest enemy spawn) so the battlefield
 * reads as a path of struggle rather than a uniform-random splatter.
 *
 * Decals render on floor tiles only, and still skip a chebyshev-1
 * buffer around every spawn so mission-start screenshots stay clean.
 */
export function drawFloorDecals(g: Graphics, map: GridMap) {
  const biome = biomeFor(map.tileset);
  const decals = biome.decalPool;
  if (decals.length === 0) return;
  const alphaBoost = biome.paintedFloors ? (biome.paintedFloorRendering?.decalAlphaBoost ?? 1) : 1;

  const bufferKeys = new Set<number>();
  const addBuffer = (px: number, py: number) => {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        bufferKeys.add((py + dy) * 4096 + (px + dx));
      }
    }
  };
  const players = map.playerSpawns;
  const enemies = map.enemySpawns.map((e) => e.pos);
  for (const p of players) addBuffer(p.x, p.y);
  for (const p of enemies) addBuffer(p.x, p.y);

  // Combat lanes: each player spawn → its nearest enemy spawn.
  const lanes: Array<[Vec2, Vec2]> = [];
  for (const p of players) {
    if (enemies.length === 0) break;
    let best = enemies[0], bestD = Infinity;
    for (const e of enemies) {
      const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
      if (d < bestD) { bestD = d; best = e; }
    }
    lanes.push([p, best]);
  }

  // Point-to-segment distance in grid units. Returns Infinity when
  // there are no lanes (e.g. a test map with no enemies).
  function laneDist(x: number, y: number): number {
    let best = Infinity;
    for (const [a, b] of lanes) {
      const vx = b.x - a.x, vy = b.y - a.y;
      const wx = x - a.x,  wy = y - a.y;
      const vv = vx * vx + vy * vy;
      let px = a.x, py = a.y;
      if (vv > 0) {
        let t = (wx * vx + wy * vy) / vv;
        if (t < 0) t = 0; else if (t > 1) t = 1;
        px = a.x + t * vx;
        py = a.y + t * vy;
      }
      const d = Math.hypot(x - px, y - py);
      if (d < best) best = d;
    }
    return best;
  }

  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const t = tileAt(map, x, y);
      if (!t || t.kind !== 'floor') continue;
      if (bufferKeys.has(y * 4096 + x)) continue;
      // Different hash constants from drawEnvProps so decals and props
      // don't share a position grid.
      const h = ((x * 2654435761) ^ (y * 40503)) >>> 0;
      const ld = laneDist(x, y);
      // 1.0 at the lane centreline, 0.0 at ≥3 tiles away, linear between.
      const laneFactor = Math.max(0, 1 - ld / 3);
      // Base 8% everywhere + up to 22% more along the lane. Capped at
      // 35% so even the hottest tiles still show some clean floor.
      const pct = Math.min(35, 8 + laneFactor * 22);
      if ((h % 100) >= pct) continue;
      const pickIdx = ((h >>> 5) % decals.length) | 0;
      const jx = ((h >>> 9) % 17) - 8;
      const jy = ((h >>> 14) % 9) - 4;
      const p = gridToScreen({ x, y });
      const prevAlpha = g.alpha;
      g.alpha = prevAlpha * alphaBoost;
      decals[pickIdx](g, p.x + jx, p.y + jy);
      g.alpha = prevAlpha;
    }
  }
}

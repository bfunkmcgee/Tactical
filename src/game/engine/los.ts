import type { GridMap, Vec2, CoverState } from '../types';
import { blocksLos, tileAt, inBounds } from './grid';

/** Bresenham line, inclusive of endpoints. */
export function line(a: Vec2, b: Vec2): Vec2[] {
  const pts: Vec2[] = [];
  let x0 = a.x, y0 = a.y;
  const x1 = b.x, y1 = b.y;
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  while (true) {
    pts.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) break;
    const e2 = err * 2;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 <  dx) { err += dx; y0 += sy; }
  }
  return pts;
}

/**
 * LOS from shooter to target. Endpoints are excluded from blocking checks
 * so a unit can shoot out of its own tile and at a target in cover.
 */
export function hasLineOfSight(m: GridMap, from: Vec2, to: Vec2): boolean {
  const pts = line(from, to);
  for (let i = 1; i < pts.length - 1; i++) {
    if (blocksLos(m, pts[i].x, pts[i].y)) return false;
  }
  return true;
}

/**
 * Cover state for a target relative to a shooter: inspect the 4-neighbor tile
 * of the target along the incoming shot axis. Full-cover tile adjacent = full,
 * half-cover = half, else none. This matches XCOM-style directional cover.
 */
export function getCoverState(m: GridMap, shooter: Vec2, target: Vec2): CoverState {
  const dx = Math.sign(shooter.x - target.x);
  const dy = Math.sign(shooter.y - target.y);
  let best: CoverState = 'none';
  const candidates: Vec2[] = [];
  if (dx !== 0) candidates.push({ x: target.x + dx, y: target.y });
  if (dy !== 0) candidates.push({ x: target.x, y: target.y + dy });
  for (const c of candidates) {
    if (!inBounds(m, c.x, c.y)) continue;
    const t = tileAt(m, c.x, c.y);
    if (!t) continue;
    if (t.kind === 'cover_full' && best !== 'full') best = 'full';
    else if (t.kind === 'cover_half' && best === 'none') best = 'half';
  }
  return best;
}

/** A target is "flanked" if no cover adjacent on the attack axis. */
export function isFlanked(m: GridMap, shooter: Vec2, target: Vec2): boolean {
  return getCoverState(m, shooter, target) === 'none';
}

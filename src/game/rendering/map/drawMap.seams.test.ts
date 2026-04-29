import { describe, expect, it } from 'vitest';
import { tileAt } from '../../engine/grid';
import { DRY_WELL } from '../../maps/dry_well';
import { gridToScreen } from '../isoProjection';
import { paintedFloorFootprintAt } from './drawMap';

describe('painted floor seam continuity', () => {
  it('mission-start desert floors share exact diamond edges between neighboring tiles', () => {
    const spawn = DRY_WELL.playerSpawns[0];
    expect(spawn).toBeDefined();

    const east = { x: spawn.x + 1, y: spawn.y };
    const south = { x: spawn.x, y: spawn.y + 1 };
    expect(tileAt(DRY_WELL, east.x, east.y)?.kind).toBe('floor');
    expect(tileAt(DRY_WELL, south.x, south.y)?.kind).toBe('floor');

    const spawnFootprint = paintedFloorFootprintAt(gridToScreen(spawn));
    const eastFootprint = paintedFloorFootprintAt(gridToScreen(east));
    const southFootprint = paintedFloorFootprintAt(gridToScreen(south));

    // Grid-E neighbour shares this tile's SE edge (E→S).
    expect(spawnFootprint[1].x).toBeCloseTo(eastFootprint[0].x, 6);
    expect(spawnFootprint[1].y).toBeCloseTo(eastFootprint[0].y, 6);
    expect(spawnFootprint[2].x).toBeCloseTo(eastFootprint[3].x, 6);
    expect(spawnFootprint[2].y).toBeCloseTo(eastFootprint[3].y, 6);
    // Grid-S neighbour shares this tile's SW edge (S→W).
    expect(spawnFootprint[2].x).toBeCloseTo(southFootprint[1].x, 6);
    expect(spawnFootprint[2].y).toBeCloseTo(southFootprint[1].y, 6);
    expect(spawnFootprint[3].x).toBeCloseTo(southFootprint[0].x, 6);
    expect(spawnFootprint[3].y).toBeCloseTo(southFootprint[0].y, 6);
  });
});

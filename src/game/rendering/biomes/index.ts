import type { Graphics } from 'pixi.js';
import type { GridMap, TileKind } from '../../types';
import type { PropDraw, TilePalette } from '../context';
import {
  DESERT_PALETTE, DESERT_PROPS, DESERT_DECALS, EDGE_DUNES,
  drawDesertDetail, drawDesertCoverDetail, drawDesertCoverVariant,
  DESERT_PAINTED_FLOORS, DESERT_PAINTED_FLOOR_RENDERING,
} from './desert';
import {
  REFINERY_PALETTE, REFINERY_PROPS, REFINERY_DECALS, EDGE_REFINERY_SCRAP,
  drawRefineryGroundDetail, drawRefineryCover,
} from './refinery';
import {
  URBAN_PALETTE, URBAN_PROPS, URBAN_DECALS, EDGE_URBAN_RUBBLE,
  drawUrbanCoverDetail, drawUrbanCoverVariant,
} from './urban';

/**
 * BiomeModule — common shape per biome. `drawCover` (refinery-style custom
 * silhouette) and `drawCoverDetail` (desert-style overlay on the default
 * rect silhouette) are mutually exclusive in practice: refinery draws its
 * own pipes/tanks, while desert overlays brick courses on the default
 * trapezoid. Urban uses neither.
 */
export type BiomeModule = {
  palette: TilePalette;
  propPool: PropDraw[];
  decalPool: PropDraw[];
  edgePool: PropDraw[];
  drawGroundDetail?: (
    g: Graphics, kind: TileKind, variant: number,
    px: number, py: number, gx: number, gy: number, pal: TilePalette,
  ) => void;
  drawCoverDetail?: (
    g: Graphics, kind: TileKind,
    px: number, py: number, h: number, gx: number, gy: number, pal: TilePalette,
  ) => void;
  drawCover?: (
    g: Graphics, kind: TileKind,
    px: number, py: number, h: number, hash: number, pal: TilePalette,
  ) => void;
  /**
   * Optional per-tile silhouette variant for ISOLATED cover blocks.
   * Returning `'drew'` means the biome painted both silhouette + detail
   * for this tile and the default trapezoid + drawCoverDetail should be
   * skipped. Returning `'default'` falls through to the standard path.
   *
   * Connected cover tiles (a continuous wall via the extender ribbons)
   * are NEVER routed here — they always use the default trapezoid so
   * the bridging extenders look right.
   */
  drawCoverVariant?: (
    g: Graphics, kind: TileKind,
    px: number, py: number, h: number, hash: number, pal: TilePalette,
  ) => 'drew' | 'default';
  /**
   * Optional painted floor variants. When set + the texture is in the
   * sprite cache, `drawMap` mounts a Sprite per floor tile (variant
   * picked by tile hash) instead of the procedural diamond + sand-
   * grain combo. Missing entries fall through to the procedural path.
   *
   * Each entry pairs a `spriteCache` lookup key (used by `drawMap` to
   * resolve the texture without touching the URL) with the public asset
   * URL (used by `ensureSpritesLoaded` to populate the cache).
   */
  paintedFloors?: ReadonlyArray<{ cacheKey: string; url: string }>;
  /**
   * Painted-floor rendering controls for this biome. Lets each biome
   * ship floor textures at its own authored source size and tune tiny
   * per-tile color/opacity jitter to break up visible card repetition.
   */
  paintedFloorRendering?: {
    sourceWidth: number;
    sourceHeight: number;
    overscan: number;
    jitter?: {
      hueDeg: number;
      value: number;
      alpha: number;
    };
    /**
     * Multipliers applied to procedural decals/props for floor tiles
     * when painted floors are active.
     */
    decalAlphaBoost?: number;
    propAlphaBoost?: number;
  };
};

export const DESERT_BIOME: BiomeModule = {
  palette: DESERT_PALETTE,
  propPool: DESERT_PROPS,
  decalPool: DESERT_DECALS,
  edgePool: EDGE_DUNES,
  drawGroundDetail: drawDesertDetail,
  drawCoverDetail: drawDesertCoverDetail,
  drawCoverVariant: drawDesertCoverVariant,
  paintedFloors: DESERT_PAINTED_FLOORS,
  paintedFloorRendering: DESERT_PAINTED_FLOOR_RENDERING,
};

export const REFINERY_BIOME: BiomeModule = {
  palette: REFINERY_PALETTE,
  propPool: REFINERY_PROPS,
  decalPool: REFINERY_DECALS,
  edgePool: EDGE_REFINERY_SCRAP,
  drawGroundDetail: drawRefineryGroundDetail,
  drawCover: drawRefineryCover,
};

export const URBAN_BIOME: BiomeModule = {
  palette: URBAN_PALETTE,
  propPool: URBAN_PROPS,
  decalPool: URBAN_DECALS,
  edgePool: EDGE_URBAN_RUBBLE,
  drawCoverDetail: drawUrbanCoverDetail,
  drawCoverVariant: drawUrbanCoverVariant,
};

/** Pick the biome module for a given tileset. Defaults to urban. */
export function biomeFor(tileset: GridMap['tileset']): BiomeModule {
  if (tileset === 'desert') return DESERT_BIOME;
  if (tileset === 'desert-refinery') return REFINERY_BIOME;
  return URBAN_BIOME;
}

/** Shorthand when only the palette is needed. */
export function paletteFor(tileset: GridMap['tileset']): TilePalette {
  return biomeFor(tileset).palette;
}

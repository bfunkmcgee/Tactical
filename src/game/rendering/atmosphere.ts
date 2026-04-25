import { Application, Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { GridMap } from '../types';

/**
 * Atmospheric finishing layer — a vignette + per-biome colour grade
 * + ambient dust motes stacked above the world. Cheap mood lift
 * toward a more painted presentation without re-authoring any sprite art.
 *
 * Three screen-space layers mounted at the top of `app.stage`:
 *  - `tint`: full-canvas solid colour at low alpha with `multiply`
 *    blend. Biome-specific (warm desert, cool refinery) so the
 *    rendered scene picks up an environmental cast.
 *  - `dust`: ambient warm-white motes drifting screen-space
 *    (independent of camera pan / zoom).
 *  - `vignette`: full-canvas radial gradient texture, darkening the
 *    corners. Same texture across biomes; never re-renders.
 *
 * All three resize on `app.renderer.resize` so a phone rotation
 * stays full-bleed.
 */

export type AtmosphereHandle = {
  /** Update the per-biome tint when the active map changes. */
  setTileset(tileset: GridMap['tileset']): void;
  /** Per-frame tick for the dust mote sim. Driven from PixiStage's ticker. */
  tick(dtMs: number): void;
  /** Tear down the atmosphere layer (called from PixiStage cleanup). */
  destroy(): void;
};

const BIOME_TINT: Record<NonNullable<GridMap['tileset']>, { color: number; alpha: number }> = {
  // Warm sand wash — pushes hues toward the desert palette.
  'desert':           { color: 0xffd9a8, alpha: 0.18 },
  // Cooler dust + steel — refinery reads colder than open desert.
  'desert-refinery':  { color: 0xc8c0d8, alpha: 0.16 },
  // Default urban — neutral cool wash.
  'urban':            { color: 0xb8c8e0, alpha: 0.14 },
};
const URBAN_TINT = BIOME_TINT.urban;

/** Ambient dust density. Tuned for a ~390×780 phone — scales loosely
 *  with renderer size in `topUpDust`. */
const DUST_DENSITY_PER_PX2 = 24 / (390 * 780);

type DustMote = {
  x: number; y: number;
  vx: number; vy: number;   // pixels/sec drift
  r: number;
  ageMs: number;
  ttlMs: number;
};

export function mountAtmosphere(app: Application): AtmosphereHandle {
  const layer = new Container();
  layer.eventMode = 'none';                     // never intercept input
  layer.zIndex = 9999;

  // ---- Biome tint (solid sprite with multiply blend) ----
  const tint = new Sprite(Texture.WHITE);
  tint.anchor.set(0.5, 0.5);
  tint.tint = URBAN_TINT.color;
  tint.alpha = URBAN_TINT.alpha;
  tint.blendMode = 'multiply';

  // ---- Dust mote layer (Graphics redrawn each tick) ----
  const dustG = new Graphics();
  dustG.eventMode = 'none';
  const dust: DustMote[] = [];

  // ---- Vignette (radial gradient, generated once via canvas) ----
  const vignette = new Sprite(makeVignetteTexture(1024, 1024));
  vignette.anchor.set(0.5, 0.5);

  // Tint underneath, dust above tint, vignette on top so the corners
  // darken AFTER both colour cast and dust render.
  layer.addChild(tint, dustG, vignette);
  app.stage.addChild(layer);

  let bounds = { w: 0, h: 0 };

  function topUpDust(): void {
    const target = Math.max(8, Math.round(bounds.w * bounds.h * DUST_DENSITY_PER_PX2));
    while (dust.length < target) {
      dust.push({
        x: Math.random() * bounds.w,
        y: Math.random() * bounds.h,
        vx: 4 + Math.random() * 10,    // slow rightward drift
        vy: 6 + Math.random() * 12,    // gentle fall
        r: 0.6 + Math.random() * 1.2,
        ageMs: 0,
        ttlMs: 6000 + Math.random() * 6000,
      });
    }
  }

  function resize(): void {
    const w = app.renderer.width;
    const h = app.renderer.height;
    bounds = { w, h };
    tint.position.set(w / 2, h / 2);
    tint.width = w; tint.height = h;
    vignette.position.set(w / 2, h / 2);
    vignette.width = w; vignette.height = h;
    topUpDust();
  }
  resize();
  app.renderer.on('resize', resize);

  function setTileset(tileset: GridMap['tileset']): void {
    const t = (tileset && BIOME_TINT[tileset]) || URBAN_TINT;
    tint.tint = t.color;
    tint.alpha = t.alpha;
  }

  function tick(dtMs: number): void {
    if (bounds.w <= 0 || bounds.h <= 0) return;
    const dtSec = dtMs / 1000;
    for (let i = dust.length - 1; i >= 0; i--) {
      const d = dust[i];
      d.ageMs += dtMs;
      d.x += d.vx * dtSec;
      d.y += d.vy * dtSec;
      // Wrap horizontally so motes that drift off the right re-enter
      // on the left — keeps the field stable without spawning noise.
      if (d.x > bounds.w + 4) d.x = -4;
      // Recycle when a mote either expires or drifts off the bottom.
      if (d.ageMs >= d.ttlMs || d.y > bounds.h + 4) {
        dust.splice(i, 1);
      }
    }
    topUpDust();

    // Render. Single Graphics rebuild per frame — cheap for ~24 circles.
    dustG.clear();
    for (const d of dust) {
      const t = d.ageMs / d.ttlMs;
      const life = t < 0.2 ? t / 0.2
        : t > 0.8     ? (1 - t) / 0.2
        : 1;
      if (life <= 0) continue;
      // Warm off-white speck. Soft and low-alpha — atmospheric, not flashy.
      dustG.circle(d.x, d.y, d.r).fill({ color: 0xfff4d8, alpha: life * 0.32 });
    }
  }

  function destroy(): void {
    app.renderer.off('resize', resize);
    layer.destroy({ children: true });
  }

  return { setTileset, tick, destroy };
}

/**
 * Render a radial-gradient vignette into an offscreen canvas and wrap
 * it as a Pixi Texture. Generated once per mount so resize just scales
 * the sprite — far cheaper than re-rasterising on every resize.
 */
function makeVignetteTexture(w: number, h: number): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const cx = w / 2, cy = h / 2;
  const inner = Math.min(w, h) * 0.30;
  const outer = Math.hypot(cx, cy);
  const grd = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
  grd.addColorStop(0,    'rgba(0, 0, 0, 0)');
  grd.addColorStop(0.55, 'rgba(0, 0, 0, 0.18)');
  grd.addColorStop(0.85, 'rgba(0, 0, 0, 0.42)');
  grd.addColorStop(1,    'rgba(0, 0, 0, 0.62)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, w, h);
  return Texture.from(canvas);
}

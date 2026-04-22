import { Container, Graphics, Text } from 'pixi.js';
import { soundEngine } from '../audio/soundEngine';
import type { Vec2 } from '../types';
import { gridToScreen } from './isoProjection';

/**
 * FX system: blood spurts + damage-number floaters. Owns its own
 * transient state (arrays of active droplets + floaters) so the
 * simulation store doesn't have to carry presentation-only data.
 *
 * Shape returned by createFxSystem:
 *   - spawnBlood(pos, dmg) — fire from syncUnits' onHit callback
 *   - pushFloater(text, color, pos, nowMs) — drain store.floaters into here
 *   - tick(dtMs, nowMs) — integrate physics + prune expired + redraw
 *
 * This shape foreshadows Enhancement D's sim/presentation split: blood
 * + floaters never belong in authoritative combat state, they exist only
 * to drive the next frame.
 */

type ActiveFloater = { text: string; color: number; pos: Vec2; bornMs: number };
type BloodDroplet = { x: number; y: number; vx: number; vy: number; r: number };
type ActiveBlood = { bornMs: number; droplets: BloodDroplet[] };

const FLOATER_MS = 900;
const BLOOD_MS = 620;
const GRAVITY_PX_PER_S2 = 600;

export type FxSystem = {
  spawnBlood(pos: Vec2, damage: number): void;
  pushFloater(text: string, color: number, pos: Vec2, nowMs: number): void;
  tick(dtMs: number, nowMs: number): void;
};

export function createFxSystem(fxLayer: Container): FxSystem {
  const floaters: ActiveFloater[] = [];
  const bloods: ActiveBlood[] = [];

  function spawnBlood(pos: Vec2, damage: number): void {
    const origin = gridToScreen(pos);
    // One droplet per ~2 damage, clamped 3..8 so a 1-dmg pistol tap still
    // reads as a hit and a 12-dmg sniper doesn't flood the screen.
    const count = Math.max(3, Math.min(8, 2 + Math.round(damage / 2)));
    const droplets: BloodDroplet[] = [];
    for (let i = 0; i < count; i++) {
      // Spray biased upward + outward; gravity arcs them back down.
      const angle = (Math.random() * 1.2 - 0.6) - Math.PI / 2; // -162° .. -108°
      const speed = 70 + Math.random() * 70;                   // 70..140 px/s
      droplets.push({
        x: origin.x + (Math.random() - 0.5) * 4,
        y: origin.y - 26 + (Math.random() - 0.5) * 6,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 1.6 + Math.random() * 1.4,
      });
    }
    bloods.push({ bornMs: performance.now(), droplets });
    // "Crit" shorthand: any hit dealing 8+ damage gets the punchier crit
    // sound; smaller hits play the standard hit clip. Kill SFX is layered
    // on top by the combat subscriber when HP drops to zero.
    soundEngine.play(damage >= 8 ? 'crit' : 'hit');
  }

  function pushFloater(text: string, color: number, pos: Vec2, nowMs: number): void {
    floaters.push({ text, color, pos, bornMs: nowMs });
  }

  function tick(dtMs: number, nowMs: number): void {
    // Integrate blood droplet physics.
    const dtSec = dtMs / 1000;
    for (const b of bloods) {
      for (const d of b.droplets) {
        d.x += d.vx * dtSec;
        d.y += d.vy * dtSec;
        d.vy += GRAVITY_PX_PER_S2 * dtSec;
      }
    }
    // Prune aged bloods and floaters.
    for (let i = bloods.length - 1; i >= 0; i--) {
      if (nowMs - bloods[i].bornMs > BLOOD_MS) bloods.splice(i, 1);
    }
    for (let i = floaters.length - 1; i >= 0; i--) {
      if (nowMs - floaters[i].bornMs > FLOATER_MS) floaters.splice(i, 1);
    }
    renderFx(fxLayer, floaters, bloods, nowMs);
  }

  return { spawnBlood, pushFloater, tick };
}

/**
 * Per-frame pass over the fx layer: draws active blood-spurt droplets
 * underneath damage-number floaters, then clears and redraws the layer
 * in a single removeChildren call.
 */
function renderFx(
  layer: Container,
  floaters: ActiveFloater[],
  bloods: ActiveBlood[],
  now: number,
) {
  layer.removeChildren();
  // Blood first so damage numbers read on top.
  if (bloods.length > 0) {
    const g = new Graphics();
    for (const b of bloods) {
      const age = now - b.bornMs;
      // Keep full alpha for the first third, fade through the rest.
      const alpha = age < BLOOD_MS * 0.33
        ? 1
        : Math.max(0, 1 - (age - BLOOD_MS * 0.33) / (BLOOD_MS * 0.67));
      if (alpha <= 0) continue;
      for (const d of b.droplets) {
        // Darker core + lighter rim for a bit of shape at small sizes.
        g.circle(d.x, d.y, d.r * 1.25).fill({ color: 0x5a0808, alpha: alpha * 0.9 });
        g.circle(d.x, d.y, d.r).fill({ color: 0xb21a1a, alpha });
      }
    }
    layer.addChild(g);
  }
  // Damage numbers.
  for (const f of floaters) {
    const progress = Math.min(1, (now - f.bornMs) / FLOATER_MS);
    const p = gridToScreen(f.pos);
    const t = new Text({
      text: f.text,
      style: { fill: f.color, fontSize: 16, fontWeight: 'bold', fontFamily: 'system-ui' },
    });
    t.anchor.set(0.5, 1);
    t.position.set(p.x, p.y - 56 - progress * 36);
    t.alpha = Math.max(0, 1 - progress * 1.1);
    layer.addChild(t);
  }
}

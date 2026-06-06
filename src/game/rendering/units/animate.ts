import type { Container, Graphics } from 'pixi.js';
import type { UnitId } from '../../types';
import { ANIMATION_LIMITS, WEAPON_ANIMATION_LIMITS, HIT_FLASH_MS, DEATH_DURATION_MS, MUZZLE_OFFSET } from './constants';
import type { UnitNode } from './UnitNode';

export const IDLE_MOTION_ENABLED = true;

type PostureTuning = {
  walkBob: number;
  walkLean: number;
  idleSway: number;
  deathSlump: number;
};

const DEFAULT_POSTURE_TUNING: PostureTuning = {
  walkBob: 1,
  walkLean: 1,
  idleSway: 1,
  deathSlump: 1,
};

const POSTURE_TUNING: Record<string, PostureTuning> = {
  upright: DEFAULT_POSTURE_TUNING,
  hunched: { walkBob: 0.82, walkLean: 1.22, idleSway: 1.18, deathSlump: 1.2 },
  floating: { walkBob: 0.28, walkLean: 0.6, idleSway: 1.4, deathSlump: 0.62 },
  ethereal: { walkBob: 0.28, walkLean: 0.6, idleSway: 1.4, deathSlump: 0.62 },
};

function postureTuning(profile?: string): PostureTuning {
  return profile ? (POSTURE_TUNING[profile] ?? DEFAULT_POSTURE_TUNING) : DEFAULT_POSTURE_TUNING;
}

/**
 * Per-frame animation update. Reads each node's pending timers and builds
 * a composite body transform + muzzle-flash draw for this frame.
 *
 * Animation channels (additive):
 *  - movement lerp + walk cycle (lean, step-bob, squash — two steps per tile)
 *  - idle bob + selected pulse (when stationary)
 *  - fire sequence (windup → muzzle flash at shot moment → recoil → return)
 *  - hit flash (red tint + horizontal jitter)
 *  - death fade (alpha + slump + fall-sideways rotation)
 */
export function tickUnitAnimations(
  layer: Container,
  nodes: Map<UnitId, UnitNode>,
  dtMs: number,
  nowMs: number,
) {
  for (const node of nodes.values()) {
    // ----- Facing blend: short left/right turn tween so fire events can
    // rotate toward targets without a one-frame mirror pop.
    const facingBlend = interpolateFacing(node, dtMs);
    const facingSign: 1 | -1 = facingBlend >= 0 ? 1 : -1;

    // ----- Movement interpolation.
    if (node.moveDurationMs > 0) {
      node.moveMs += dtMs;
      const raw = Math.min(1, node.moveMs / node.moveDurationMs);
      const tE = easeOutQuad(raw);
      const sx = node.currentScreen.x + (node.targetScreen.x - node.currentScreen.x) * tE;
      const sy = node.currentScreen.y + (node.targetScreen.y - node.currentScreen.y) * tE;
      node.container.position.set(sx, sy);
      if (raw >= 1) {
        node.currentScreen = { x: node.targetScreen.x, y: node.targetScreen.y };
        node.moveDurationMs = 0;
        node.moveMs = 0;
      }
    }

    const alive = node.deathMs === null;
    const moving = node.moveDurationMs > 0;
    const posture = postureTuning(node.posture);

    // ----- Walk cycle (while moving): lean + two-step bob + squash on foot-plants.
    // walkSway is an independent weapon rotation that counter-balances the lean.
    let walkLean = 0, walkBob = 0, walkScaleY = 1, walkSway = 0;
    if (moving && alive) {
      const raw = node.moveMs / node.moveDurationMs;
      // Two steps per tile → 4 half-cycles.
      walkLean = Math.sin(raw * Math.PI * 2) * 0.08 * posture.walkLean; // ±4.6° baseline
      walkBob = -Math.abs(Math.sin(raw * Math.PI * 4)) * 2.5 * posture.walkBob; // body lifts on stride peak
      walkScaleY = 1 - Math.abs(Math.sin(raw * Math.PI * 4 - Math.PI / 2)) * 0.05; // squash on plant
      walkSway = -walkLean * 0.6; // weapon lags/opposes the body swing
    }

    // Idle channels are intentionally low-amplitude + low-frequency so the
    // unit breathes without "hovering". Amplitudes are deterministic per unit
    // (via bobPhase) so squads don't sync-breathe.
    let idleBreathY = 0;
    let idleBreathScaleY = 0;
    let idleShoulderSway = 0;
    let idleWeaponSway = 0;
    if (IDLE_MOTION_ENABLED && !moving && alive) {
      const breathT = nowMs * 0.0011 + node.bobPhase;
      const swayT = nowMs * 0.0009 + node.bobPhase * 0.7;
      const breathAmp = 0.3 + ((Math.sin(node.bobPhase * 1.7) + 1) * 0.25); // 0.3..0.8 px
      // Keep idle additive but subordinate to firing.
      const fireIdleFade = node.fireAnimMs > 0 ? 0.2 : 1;
      idleBreathY = Math.sin(breathT) * breathAmp * fireIdleFade;
      idleBreathScaleY = Math.sin(breathT + Math.PI / 2) * 0.01 * fireIdleFade; // ±0.01
      idleShoulderSway = Math.sin(swayT) * 0.015 * fireIdleFade * posture.idleSway;
      idleWeaponSway = Math.sin(swayT + 0.85) * 0.012 * fireIdleFade * posture.idleSway;
    }

    // ----- Fire sequence: windup → one-or-more shots → return.
    // Only the weapon (arm+gun) lifts toward eye level and rotates into
    // aim; the body holds still except for a small recoil push-back on
    // each shot. This reads as "arms move independently of the torso."
    let bodyPitch = 0, bodyPushX = 0, bodyPushY = 0;
    let weaponAim = 0, weaponLift = 0, flashIntensity = 0;
    if (node.fireAnimMs > 0) {
      node.fireAnimMs = Math.max(0, node.fireAnimMs - dtMs);
      const style = node.fireStyle;
      const elapsed = style.totalMs - node.fireAnimMs;
      const aimPitchTarget = Math.max(-0.12, Math.min(0.12, node.fireTargetDir.y * 0.22));
      node.aimYaw = lerp(node.aimYaw ?? 0, aimPitchTarget, 0.35);
      node.aimX = lerp(node.aimX ?? 0, node.fireTargetDir.y * 0.9, 0.25);
      const burstSpanMs = style.shots > 1
        ? (style.shots - 1) * style.shotSpacingMs + style.shotWindowMs
        : style.shotWindowMs;
      const returnStart = style.windupMs + burstSpanMs;
      const returnMs = Math.max(1, style.totalMs - returnStart);

      if (elapsed < style.windupMs) {
        // Windup: arms raise the weapon up (lift) and angle it toward the
        // target (rotation). Body is still.
        const p = elapsed / style.windupMs;
        const ease = easeOutQuad(p);
        weaponAim = -style.windupRad * facingBlend * ease;
        weaponLift = -style.weaponLiftPx * ease;
      } else if (elapsed < returnStart) {
        // Shot phase: hold weapon at aim + flash/kick for each active shot.
        const shotPhase = elapsed - style.windupMs;
        let flashP = -1;
        for (let i = 0; i < style.shots; i++) {
          const start = i * style.shotSpacingMs;
          if (shotPhase >= start && shotPhase < start + style.shotWindowMs) {
            flashP = (shotPhase - start) / style.shotWindowMs;
            break;
          }
        }
        weaponAim = -style.windupRad * facingBlend;
        weaponLift = -style.weaponLiftPx;
        if (flashP >= 0) {
          // Active shot: muzzle flash + recoil on both arm and body.
          flashIntensity = 1 - flashP;
          const kick = 1 - flashP;
          weaponAim += -style.kickRad * facingBlend * kick;
          weaponLift -= (2 + Math.abs(node.fireTargetDir.y) * 1.2) * kick; // weapon jerks up on recoil
          bodyPitch = 0.025 * facingBlend * kick; // subtle torso reaction
          bodyPushX = -node.fireTargetDir.x * style.recoilPx * kick;
          bodyPushY = -node.fireTargetDir.y * style.recoilPx * kick;
        }
      } else {
        // Return: weapon eases back to low-ready, body settles.
        const p = (elapsed - returnStart) / returnMs;
        const ret = 1 - easeOutQuad(Math.min(1, p));
        weaponAim = -style.windupRad * facingBlend * ret * 0.5;
        weaponLift = -style.weaponLiftPx * ret;
      }
      weaponAim += (node.aimYaw ?? 0) * facingBlend;
      weaponLift += -(node.aimX ?? 0);
    } else {
      node.aimYaw = lerp(node.aimYaw ?? 0, 0, 0.22);
      node.aimX = lerp(node.aimX ?? 0, 0, 0.22);
    }


    // ----- Normalize/clamp additive channels before they touch sprites.
    // Limits are mirrored via facingSign/facingBlend so left/right facings
    // keep identical anatomical envelopes.
    // `node.fireClass` may be 'melee' (no firearm limits row) — fall back to
    // the default envelope for those, same as the renderer's other lookups.
    const classLimits = WEAPON_ANIMATION_LIMITS[
      (node.fireClass ?? 'default') as keyof typeof WEAPON_ANIMATION_LIMITS
    ] ?? WEAPON_ANIMATION_LIMITS.default;
    const clampedBodyPitch = clampSymmetric(bodyPitch, ANIMATION_LIMITS.torsoRotationRad);
    const clampedWeaponAim = clampSymmetric(weaponAim, classLimits.rotationRad);
    const clampedWeaponLift = clampSymmetric(weaponLift, classLimits.liftPx);
    const clampedIdleShoulderSway = clampSymmetric(idleShoulderSway, ANIMATION_LIMITS.armsBackSwayRad);

    // ----- Hit flash: tint + jitter.
    let jitterX = 0;
    if (node.hitFlashMs > 0) {
      node.hitFlashMs = Math.max(0, node.hitFlashMs - dtMs);
      const a = node.hitFlashMs / HIT_FLASH_MS;
      jitterX = (Math.random() - 0.5) * 3 * a;
      applyTint(node, blendRed(a));
    } else {
      applyTint(node, blendWearTint(node.dirtTint, node.wearLevel));
    }
    applyWearOverlays(node);

    // ----- Compose body transform. Two paths — rig-composed units get
    // per-part channels (legs squash, torso lean, head counter-lean,
    // arms-back damped sway); bespoke-SVG units rotate as one.
    if (node.rigComposition) {
      // Rigged path: body holds only facing + hit-jitter. Per-part
      // transforms land the walk cycle + recoil on the right layers.
      if (node.deathMs === null) {
        const p = node.rigComposition.parts;
        const base = node.rigComposition.basePartPos;
        const baseScale = node.rigComposition.baseScale;
        // Legs absorb the squash on foot-plant so the torso doesn't
        // visibly stretch — reads as weight on the ground. walkScaleY
        // is a unitless multiplier (1 idle, ~0.95 on plant); apply it
        // ON TOP of baseScale (the rig's 96×128 → on-screen ratio).
        // Overwriting scale.y with walkScaleY directly would inflate
        // the legs sprite to ~2.4× normal height and push its drawn
        // content one iso tile south of the unit.
        p.legs.scale.y = baseScale * walkScaleY;
        // Torso carries the lean + bob + recoil push. Head and arms-back
        // live next to torso in the root; they rotate independently
        // rather than inheriting the torso's rotation. Walk-cycle and
        // recoil deltas are ADDITIVE on top of the static placement
        // (basePartPos) — humanRigBody put torso at (partLeftX,partTopY)
        // and overwriting that here would shift the torso ~one iso tile
        // SE of legs/head/arms-back.
        p.torso.rotation = clampSymmetric(walkLean + clampedBodyPitch, ANIMATION_LIMITS.torsoRotationRad);
        p.torso.position.x = base.x + bodyPushX;
        p.torso.position.y = base.y + walkBob + bodyPushY + idleBreathY;
        p.torso.scale.y = 1 + idleBreathScaleY;
        // Head counter-leans a fraction of the torso's rotation — the
        // eyeline stays closer to level as the body sways. A common 2D
        // animation trick; feels alive without a full lookAt rig.
        p.head.rotation = clampSymmetric(-walkLean * 0.35 - clampedIdleShoulderSway * 0.25, ANIMATION_LIMITS.headCounterRotationRad);
        // Arms-back rides a damped sway — the off-hand follows body
        // motion without flapping.
        const armsBackSway = (walkSway * 0.8 + clampedIdleShoulderSway) * (node.armsBackSwayFactor ?? 1);
        p['arms-back'].rotation = clampSymmetric(armsBackSway, ANIMATION_LIMITS.armsBackSwayRad);
      }
      node.body.scale.set(facingBlend, 1);
      node.body.rotation = 0;
      node.body.position.x = jitterX;
      node.body.position.y = 0;
    } else {
      // Bespoke-SVG path: body is monolithic; everything rotates as one.
      node.body.scale.set(facingBlend, walkScaleY * (1 + idleBreathScaleY * 0.35));
      node.body.rotation = clampSymmetric(walkLean + clampedBodyPitch, ANIMATION_LIMITS.torsoRotationRad);
      node.body.position.x = jitterX + bodyPushX;
      node.body.position.y = walkBob + bodyPushY + idleBreathY * 0.45;
    }

    // ----- Selection ring alpha pulse — drives the "who's active" cue
    // since the character body itself is static in idle.
    if (node.selected && node.deathMs === null) {
      node.selectionRing.alpha = 0.55 + Math.sin(nowMs * 0.004) * 0.35;
    }

    // ----- Weapon transform. The arms/gun move independently of the
    // body: `weaponAim` rotates around the grip, `weaponLift` raises
    // the whole wrap toward eye level during aim.
    if (node.weaponWrap) {
      node.weaponWrap.rotation = clampSymmetric(walkSway + clampedWeaponAim + idleWeaponSway, classLimits.rotationRad);
      node.weaponWrap.position.y = node.weaponRestY + clampedWeaponLift;
    }

    // ----- Muzzle flash: drawn in weapon-wrap space when available so it
    // follows the rotating barrel. Falls back to container-space otherwise.
    drawMuzzleFlash(
      node.muzzleFlash, facingSign, flashIntensity,
      !!node.weaponWrap, node.fireStyle.flashScale,
      node.muzzleOffset,
    );

    // ----- Death: fade to a dim corpse + slump + fall-sideways rotation.
    // The container stays visible after the fade so the body remains on
    // the ground for the rest of the mission. A final alpha of 0.5 plus
    // a dusty tint reads as "down, not gone" without drawing attention
    // away from live units.
    if (node.deathMs !== null) {
      // Once the slump completes, stop ticking — no point incrementing
      // forever for every corpse on the map.
      if (node.deathMs < DEATH_DURATION_MS) node.deathMs += dtMs;
      const t = Math.min(1, node.deathMs / DEATH_DURATION_MS);
      // Fade to 0.5 (corpse), not 0.
      node.container.alpha = 1 - t * 0.5;
      // For rig-composed units, zero per-part transforms on death so
      // the body-level tip-over applies to the whole composition as one.
      // Without this the torso + head + arms-back would keep their
      // alive-state walk-cycle rotations underneath the tip-over.
      if (node.rigComposition) {
        const p = node.rigComposition.parts;
        const base = node.rigComposition.basePartPos;
        const baseScale = node.rigComposition.baseScale;
        // Reset legs squash to identity (multiplicative — keeps the
        // baseScale from inflating). Reset torso to its static
        // placement, NOT (0, 0) — the latter would shift the torso
        // ~one iso tile SE of the rest of the composition right
        // before the body-level tip-over rotates the figure as one.
        p.legs.scale.y = baseScale;
        p.torso.rotation = 0;
        p.torso.position.set(base.x, base.y);
        p.torso.scale.y = 1;
        p.head.rotation = 0;
        p['arms-back'].rotation = 0;
      }
      node.body.position.y = t * 14 * posture.deathSlump;              // slump to the ground
      node.body.rotation = facingSign * 0.9 * t; // tip over 50°, feels flatter
      // Weapon drops below the grip as the character collapses.
      if (node.weaponWrap) {
        node.weaponWrap.rotation = facingSign * 1.4 * t;
        node.weaponWrap.position.y = node.weaponRestY + t * 4;
      }
      node.shadow.alpha = 1 - t * 0.35;           // shadow dims but stays
      node.hpBar.visible = false;
      node.label.visible = false;
      node.muzzleFlash.clear();
      // Once the slump completes, dim the sprite toward a cold grey-brown so
      // it reads as a corpse rather than a dim-but-alive character.
      if (t >= 1) applyTint(node, 0x6a5a4a);
    } else {
      node.container.alpha = 1;
      node.container.visible = true;
      node.shadow.alpha = 1;
    }
  }
  // zIndex changes above won't take effect unless Pixi sorts; trigger it.
  layer.sortChildren();
}

/**
 * Draw a muzzle flash at the weapon tip. `intensity` 0..1 fades the whole
 * composite (star burst + hot core + glow) so the flash blinks on and off.
 *
 * When `inWeaponSpace` is true the graphic lives inside the weapon-wrap
 * (pivot at the grip) — the "tip" offset is measured forward of the grip.
 * Otherwise it's in container-space and sits at a fixed chest-height point.
 */
export function drawMuzzleFlash(
  g: Graphics, facing: 1 | -1, intensity: number,
  inWeaponSpace: boolean, scale: number,
  offset: { x: number; y: number } = MUZZLE_OFFSET,
) {
  g.clear();
  if (intensity <= 0) return;
  const x = inWeaponSpace ? offset.x * facing : 20 * facing;
  const y = inWeaponSpace ? offset.y : -30;
  const s = scale;
  // Soft outer glow.
  g.circle(x, y, 11 * s).fill({ color: 0xff9a3c, alpha: 0.4 * intensity });
  // 4-point star burst (longer along the barrel axis).
  g.poly([
    x - 14 * s * facing, y,
    x - 2 * s * facing,  y - 3 * s,
    x,                    y - 9 * s,
    x + 2 * s * facing,  y - 3 * s,
    x + 18 * s * facing, y,
    x + 2 * s * facing,  y + 3 * s,
    x,                    y + 9 * s,
    x - 2 * s * facing,  y + 3 * s,
  ]).fill({ color: 0xffe0a0, alpha: 0.85 * intensity });
  // Hot white core.
  g.circle(x, y, 3.5 * s).fill({ color: 0xffffff, alpha: 0.95 * intensity });
}

/** Apply a uniform tint to every sprite inside a unit's body/weapon hierarchy.
 *  Rig-composed units (HumanAppearance was set) maintain a flat tintTargets
 *  list on their rigComposition — walk that. Bespoke-SVG units get the
 *  three legacy sprite slots tinted directly. */
export function applyTint(node: UnitNode, tint: number) {
  if (node.rigComposition) {
    for (const sprite of node.rigComposition.tintTargets) sprite.tint = tint;
    return;
  }
  if (node.sprite) node.sprite.tint = tint;
  if (node.armsSprite) node.armsSprite.tint = tint;
  if (node.weaponSprite) node.weaponSprite.tint = tint;
  if (node.fallback) node.fallback.tint = tint;
}

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function interpolateFacing(node: UnitNode, dtMs: number): number {
  if (node.facingTurnDurationMs <= 0 || node.facing === node.targetFacing) {
    node.facing = node.targetFacing;
    node.facingTurnMs = 0;
    node.facingTurnDurationMs = 0;
    return node.facing;
  }
  node.facingTurnMs += dtMs;
  const t = Math.min(1, node.facingTurnMs / node.facingTurnDurationMs);
  const eased = easeOutQuad(t);
  const blended = node.facing + (node.targetFacing - node.facing) * eased;
  if (t >= 1) {
    node.facing = node.targetFacing;
    node.facingTurnMs = 0;
    node.facingTurnDurationMs = 0;
  }
  return blended;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Blend white → damage-red by `alpha` (0..1). Used for the hit flash.
 * At alpha=1 returns ~#ff5a6a (matches the enemy HP bar colour).
 */
function blendRed(alpha: number): number {
  const r = 255;
  const g = Math.round(255 - 165 * alpha);
  const b = Math.round(255 - 149 * alpha);
  return (r << 16) | (g << 8) | b;
}

function blendWearTint(dirtTint: number, wearLevel: number): number {
  const t = Math.max(0, Math.min(1, wearLevel / 100));
  const wr = 140, wg = 118, wb = 96;
  const dr = (dirtTint >> 16) & 0xff;
  const dg = (dirtTint >> 8) & 0xff;
  const db = dirtTint & 0xff;
  const r = Math.round(dr + (wr - dr) * (t * 0.35));
  const g = Math.round(dg + (wg - dg) * (t * 0.35));
  const b = Math.round(db + (wb - db) * (t * 0.35));
  return (r << 16) | (g << 8) | b;
}

function applyWearOverlays(node: UnitNode): void {
  const t = Math.max(0, Math.min(1, node.wearLevel / 100));
  const overlays = node.rigComposition?.wearOverlays;
  if (!overlays) {
    if (node.fallback) node.fallback.alpha = 1 - Math.min(0.3, t * 0.25);
    return;
  }
  if (overlays.scratch) overlays.scratch.alpha = Math.min(0.65, t * 0.9);
  if (overlays.tear) overlays.tear.alpha = t > 0.2 ? Math.min(0.6, (t - 0.2) * 0.8) : 0;
  if (overlays.scorch) overlays.scorch.alpha = t > 0.45 ? Math.min(0.7, (t - 0.45) * 1.1) : 0;
}

function clampSymmetric(value: number, absLimit: number): number {
  return Math.max(-absLimit, Math.min(absLimit, value));
}

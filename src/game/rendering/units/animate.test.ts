import { describe, it, expect } from 'vitest';
import type { UnitNode } from './UnitNode';
import { IDLE_MOTION_ENABLED, tickUnitAnimations } from './animate';
import { ANIMATION_LIMITS, WEAPON_ANIMATION_LIMITS } from './constants';

type Transform = {
  x: number;
  y: number;
  set: (x: number, y?: number) => void;
};

type Scale = Transform;

function makeTransform(x = 0, y = 0): Transform {
  return {
    x,
    y,
    set(nx: number, ny?: number) {
      this.x = nx;
      this.y = ny ?? nx;
    },
  };
}

function makeNode(opts: { rig: boolean; alive: boolean; armsBackSwayFactor?: number }): UnitNode {
  const muzzleFlash = {
    clear() { return this; },
    circle() { return this; },
    poly() { return this; },
    fill() { return this; },
  };
  const torso = {
    rotation: 0,
    position: makeTransform(4, 7),
    scale: makeTransform(1, 1),
  };
  const head = {
    rotation: 0,
    position: makeTransform(0, 0),
    scale: makeTransform(1, 1),
  };
  const armsBack = {
    rotation: 0,
    position: makeTransform(0, 0),
    scale: makeTransform(1, 1),
  };

  return {
    container: { position: makeTransform(), alpha: 1, visible: true } as never,
    shadow: { alpha: 1 } as never,
    body: { position: makeTransform(), scale: makeTransform(1, 1), rotation: 0 } as never,
    sprite: null,
    fallback: null,
    weaponWrap: { rotation: 0, position: makeTransform() } as never,
    weaponSprite: null,
    armsSprite: null,
    weaponRestY: 2,
    muzzleOffset: { x: 0, y: 0 },
    muzzleFlash: muzzleFlash as never,
    hpBar: { visible: true } as never,
    label: { visible: true } as never,
    ornaments: {} as never,
    selectionRing: { alpha: 0 } as never,
    spriteTop: 0,
    currentScreen: { x: 0, y: 0 },
    targetScreen: { x: 0, y: 0 },
    moveMs: 0,
    moveDurationMs: 0,
    facing: 1,
    targetFacing: 1,
    facingTurnMs: 0,
    facingTurnDurationMs: 0,
    prevHp: 10,
    dirtTint: 0xffffff,
    wearLevel: 0,
    wearEventScore: 0,
    hitFlashMs: 0,
    fireAnimMs: 0,
    fireClass: 'default',
    fireStyle: {
      totalMs: 100,
      windupMs: 20,
      shots: 1,
      shotSpacingMs: 0,
      shotWindowMs: 20,
      windupRad: 0.2,
      weaponLiftPx: 3,
      kickRad: 0.1,
      recoilPx: 1,
      flashScale: 1,
    },
    fireTargetDir: { x: 1, y: 0 },
    deathMs: opts.alive ? null : 10,
    selected: false,
    bobPhase: 0,
    rigComposition: opts.rig ? {
      parts: {
        legs: { scale: makeTransform(1, 1) as Scale },
        torso: torso,
        head: head,
        'arms-back': armsBack,
        'arms-front': { scale: makeTransform(1, 1), position: makeTransform(), rotation: 0 },
      },
      basePartPos: { x: 4, y: 7 },
      baseScale: 1,
      root: {} as never,
      armsFront: {} as never,
      headSlot: {} as never,
      shoulderSlotL: {} as never,
      shoulderSlotR: {} as never,
      backSlot: {} as never,
      waistSlot: {} as never,
      tintTargets: [],
      wearOverlays: {},
    } as never : null,
    armsBackSwayFactor: opts.armsBackSwayFactor ?? 1,
  } as UnitNode;
}

describe('tickUnitAnimations idle channels', () => {
  it('keeps bespoke idle motion bounded when enabled', () => {
    const node = makeNode({ rig: false, alive: true });
    const layer = { sortChildren() {} } as never;

    let maxYOffset = 0;
    let maxScaleDelta = 0;
    for (let t = 0; t <= 15000; t += 250) {
      tickUnitAnimations(layer, new Map([[('u1' as never), node]]), 16, t);
      maxYOffset = Math.max(maxYOffset, Math.abs(node.body.position.y));
      maxScaleDelta = Math.max(maxScaleDelta, Math.abs(node.body.scale.y - 1));
    }

    if (IDLE_MOTION_ENABLED) {
      expect(maxYOffset).toBeLessThanOrEqual(0.4);
      expect(maxScaleDelta).toBeLessThanOrEqual(0.004);
    } else {
      expect(maxYOffset).toBe(0);
      expect(maxScaleDelta).toBe(0);
    }
  });

  it('does not apply idle channels to dead units', () => {
    const deadRig = makeNode({ rig: true, alive: false });
    const layer = { sortChildren() {} } as never;

    tickUnitAnimations(layer, new Map([[('u2' as never), deadRig]]), 16, 8000);

    expect(deadRig.body.position.y).toBeGreaterThan(0);
    expect(deadRig.rigComposition?.parts.torso.position.y).toBe(7);
    expect(deadRig.rigComposition?.parts.torso.scale.y).toBe(1);
    expect(deadRig.rigComposition?.parts['arms-back'].rotation).toBe(0);
  });

  it('keeps parity intentional between transparent and visible arms-back rigs', () => {
    const visibleArmsBack = makeNode({ rig: true, alive: true, armsBackSwayFactor: 1 });
    const transparentArmsBack = makeNode({ rig: true, alive: true, armsBackSwayFactor: 0 });
    const layer = { sortChildren() {} } as never;

    for (const n of [visibleArmsBack, transparentArmsBack]) {
      n.moveDurationMs = 100;
      n.moveMs = 25;
    }

    tickUnitAnimations(layer, new Map([[('u8' as never), visibleArmsBack]]), 16, 5000);
    tickUnitAnimations(layer, new Map([[('u9' as never), transparentArmsBack]]), 16, 5000);

    // All other rig channels should remain in parity.
    expect(transparentArmsBack.rigComposition?.parts.torso.rotation)
      .toBe(visibleArmsBack.rigComposition?.parts.torso.rotation);
    expect(transparentArmsBack.rigComposition?.parts.head.rotation)
      .toBe(visibleArmsBack.rigComposition?.parts.head.rotation);
    // Transparent arms-back rigs intentionally suppress the sway channel.
    expect(transparentArmsBack.rigComposition?.parts['arms-back'].rotation).toBeCloseTo(0, 10);
    expect(Math.abs(visibleArmsBack.rigComposition!.parts['arms-back'].rotation)).toBeGreaterThan(0);
  });
});


describe('tickUnitAnimations facing interpolation for bespoke units', () => {
  it('blends x-scale continuously during fire-triggered turns', () => {
    const node = makeNode({ rig: false, alive: true });
    const layer = { sortChildren() {} } as never;

    node.facing = 1;
    node.targetFacing = -1;
    node.facingTurnMs = 0;
    node.facingTurnDurationMs = 120;
    node.fireAnimMs = 120;

    tickUnitAnimations(layer, new Map([[('u3' as never), node]]), 30, 0);
    const firstX = node.body.scale.x;

    tickUnitAnimations(layer, new Map([[('u3' as never), node]]), 30, 30);
    const secondX = node.body.scale.x;

    tickUnitAnimations(layer, new Map([[('u3' as never), node]]), 30, 60);
    const thirdX = node.body.scale.x;

    tickUnitAnimations(layer, new Map([[('u3' as never), node]]), 30, 90);
    const fourthX = node.body.scale.x;

    expect(firstX).toBeLessThan(1);
    expect(firstX).toBeGreaterThan(-1);
    expect(secondX).toBeLessThan(firstX);
    expect(thirdX).toBeLessThan(secondX);
    expect(fourthX).toBe(-1);
  });
});


describe('tickUnitAnimations channel guardrails', () => {
  it('clamps rig channels under extreme stacked movement/fire inputs', () => {
    const node = makeNode({ rig: true, alive: true });
    const layer = { sortChildren() {} } as never;

    node.moveDurationMs = 100;
    node.moveMs = 25; // peak walk lean/sway
    node.fireAnimMs = 100;
    node.fireTargetDir = { x: 1, y: 8 };
    node.fireStyle.windupRad = 0.8;
    node.fireStyle.kickRad = 0.7;
    node.fireStyle.weaponLiftPx = 20;
    node.fireClass = 'heavy';

    tickUnitAnimations(layer, new Map([[('u4' as never), node]]), 16, 0);

    expect(Math.abs(node.rigComposition!.parts.torso.rotation)).toBeLessThanOrEqual(ANIMATION_LIMITS.torsoRotationRad);
    expect(Math.abs(node.rigComposition!.parts.head.rotation)).toBeLessThanOrEqual(ANIMATION_LIMITS.headCounterRotationRad);
    expect(Math.abs(node.rigComposition!.parts['arms-back'].rotation)).toBeLessThanOrEqual(ANIMATION_LIMITS.armsBackSwayRad);
    expect(Math.abs(node.weaponWrap!.rotation)).toBeLessThanOrEqual(WEAPON_ANIMATION_LIMITS.heavy.rotationRad);
    expect(Math.abs(node.weaponWrap!.position.y - node.weaponRestY)).toBeLessThanOrEqual(WEAPON_ANIMATION_LIMITS.heavy.liftPx);
  });

  it('applies symmetric clamps for left-facing extreme aim', () => {
    const node = makeNode({ rig: false, alive: true });
    const layer = { sortChildren() {} } as never;

    node.facing = -1;
    node.targetFacing = -1;
    node.fireAnimMs = 100;
    node.fireTargetDir = { x: -1, y: -8 };
    node.fireStyle.windupRad = 0.9;
    node.fireStyle.kickRad = 0.8;
    node.fireStyle.weaponLiftPx = 24;
    node.fireClass = 'pistol';

    tickUnitAnimations(layer, new Map([[('u5' as never), node]]), 16, 0);

    expect(Math.abs(node.body.rotation)).toBeLessThanOrEqual(ANIMATION_LIMITS.torsoRotationRad);
    expect(Math.abs(node.weaponWrap!.rotation)).toBeLessThanOrEqual(WEAPON_ANIMATION_LIMITS.pistol.rotationRad);
    expect(Math.abs(node.weaponWrap!.position.y - node.weaponRestY)).toBeLessThanOrEqual(WEAPON_ANIMATION_LIMITS.pistol.liftPx);
  });


  it('keeps mirrored moving+firing constraints symmetric for heavy class', () => {
    const right = makeNode({ rig: false, alive: true });
    const left = makeNode({ rig: false, alive: true });
    const layer = { sortChildren() {} } as never;

    for (const node of [right, left]) {
      node.moveDurationMs = 100;
      node.moveMs = 25;
      node.fireAnimMs = 100;
      node.fireStyle.windupRad = 0.9;
      node.fireStyle.kickRad = 0.8;
      node.fireStyle.weaponLiftPx = 18;
      node.fireClass = 'heavy';
    }
    right.facing = 1; right.targetFacing = 1; right.fireTargetDir = { x: 1, y: 7 };
    left.facing = -1; left.targetFacing = -1; left.fireTargetDir = { x: -1, y: 7 };

    tickUnitAnimations(layer, new Map([[('u6' as never), right]]), 16, 0);
    tickUnitAnimations(layer, new Map([[('u7' as never), left]]), 16, 0);

    expect(Math.abs(right.weaponWrap!.position.y - left.weaponWrap!.position.y)).toBeLessThanOrEqual(1e-6);
    expect(Math.abs(right.weaponWrap!.rotation)).toBeLessThanOrEqual(WEAPON_ANIMATION_LIMITS.heavy.rotationRad);
    expect(Math.abs(right.weaponWrap!.position.y - right.weaponRestY)).toBeLessThanOrEqual(WEAPON_ANIMATION_LIMITS.heavy.liftPx);
  });
});

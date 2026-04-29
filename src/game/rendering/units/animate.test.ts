import { describe, it, expect } from 'vitest';
import type { UnitNode } from './UnitNode';
import { IDLE_MOTION_ENABLED, tickUnitAnimations } from './animate';

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

function makeNode(opts: { rig: boolean; alive: boolean }): UnitNode {
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
});

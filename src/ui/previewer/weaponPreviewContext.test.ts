import { describe, expect, it, vi } from 'vitest';
import { MELEE_STYLE, WEAPON_HOLD } from '../../game/rendering/units/fireStyles';
import type { UnitNode } from '../../game/rendering/units/UnitNode';
import {
  applyPreviewWeaponClass,
  resolvePreviewWeaponClass,
} from './weaponPreviewContext';

describe('resolvePreviewWeaponClass', () => {
  const primary = { class: 'rifle' } as never;
  const sidearm = { class: 'pistol' } as never;

  it('uses the selected primary class when primary context is active', () => {
    expect(resolvePreviewWeaponClass({ context: 'primary', primary, sidearm })).toBe('rifle');
  });

  it('uses the selected sidearm class when sidearm context is active', () => {
    expect(resolvePreviewWeaponClass({ context: 'sidearm', primary, sidearm })).toBe('pistol');
  });

  it('supports explicit melee preview context', () => {
    expect(resolvePreviewWeaponClass({ context: 'melee', primary, sidearm })).toBe('melee');
  });

  it('falls back gracefully when selected context weapon is missing', () => {
    expect(resolvePreviewWeaponClass({ context: 'sidearm', primary, sidearm: null })).toBe('rifle');
    expect(resolvePreviewWeaponClass({ context: 'primary', primary: null, sidearm })).toBe('pistol');
    expect(resolvePreviewWeaponClass({ context: 'primary', primary: null, sidearm: null })).toBe('default');
  });
});

describe('applyPreviewWeaponClass', () => {
  it('applies pistol hold cues including one-hand arms anchor and rest height', () => {
    const node = {
      fireStyle: { totalMs: 0 },
      weaponRestY: 0,
      muzzleOffset: { x: 0, y: 0 },
      weaponWrap: { position: { set: vi.fn() } },
      weaponSprite: { anchor: { set: vi.fn() }, scale: { set: vi.fn() } },
      armsSprite: { anchor: { set: vi.fn() }, scale: { set: vi.fn() } },
    } as unknown as UnitNode;

    applyPreviewWeaponClass(node, 'pistol');

    expect(node.weaponRestY).toBe(WEAPON_HOLD.pistol.restY);
    expect(node.weaponWrap!.position.set).toHaveBeenCalledWith(0, WEAPON_HOLD.pistol.restY);
    expect(node.weaponSprite!.anchor.set).toHaveBeenCalledWith(
      WEAPON_HOLD.pistol.gripAnchor.x,
      WEAPON_HOLD.pistol.gripAnchor.y,
    );
    expect(node.armsSprite!.anchor.set).toHaveBeenCalledWith(
      WEAPON_HOLD.pistol.armsAnchor!.x,
      WEAPON_HOLD.pistol.armsAnchor!.y,
    );
  });
});


it('applies melee preview style without firearm muzzle assumptions', () => {
  const node = {
    fireStyle: { totalMs: 0 },
    weaponRestY: 0,
    muzzleOffset: { x: 0, y: 0 },
    weaponWrap: { position: { set: vi.fn() } },
  } as unknown as UnitNode;

  applyPreviewWeaponClass(node, 'melee');
  expect(node.fireStyle).toBe(MELEE_STYLE);
  expect(node.fireStyle.flashScale).toBe(0);
});

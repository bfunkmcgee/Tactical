import type { UnitNode } from '../../game/rendering/units/UnitNode';
import { FIRE_STYLES, WEAPON_HOLD } from '../../game/rendering/units/fireStyles';
import type { Weapon, WeaponClass } from '../../game/types';

export type PreviewWeaponContext = 'primary' | 'sidearm';

export function resolvePreviewWeaponClass(args: {
  context: PreviewWeaponContext;
  primary: Weapon | null;
  sidearm: Weapon | null;
}): WeaponClass | 'default' {
  const preferred = args.context === 'sidearm' ? args.sidearm : args.primary;
  const fallback = args.context === 'sidearm' ? args.primary : args.sidearm;
  return preferred?.class ?? fallback?.class ?? 'default';
}

export function applyPreviewWeaponClass(node: UnitNode, weaponClass: WeaponClass | 'default'): void {
  const hold = WEAPON_HOLD[weaponClass] ?? WEAPON_HOLD.default;
  const fireStyle = FIRE_STYLES[weaponClass] ?? FIRE_STYLES.default;
  node.fireStyle = fireStyle;
  node.weaponRestY = hold.restY;
  node.weaponWrap?.position.set(0, hold.restY);
  node.muzzleOffset = hold.muzzleOffset;

  if (node.weaponSprite) {
    node.weaponSprite.anchor.set(hold.gripAnchor.x, hold.gripAnchor.y);
    node.weaponSprite.scale.set(hold.scale);
  }

  if (node.armsSprite) {
    const armsAnchor = hold.armsAnchor ?? hold.gripAnchor;
    const armsScale = hold.armsScale ?? hold.scale;
    node.armsSprite.anchor.set(armsAnchor.x, armsAnchor.y);
    node.armsSprite.scale.set(armsScale);
  }
}

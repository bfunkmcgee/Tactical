import { describe, it, expect } from 'vitest';
import { buildHumanRigBody } from './humanRigBody';
import { HUMAN_RIG } from '../../../content/rigs';
import type { Armor, Clothing, HumanAppearance, Loadout } from '../../types';
import type { Texture } from 'pixi.js';

/**
 * Phase 3 tests — rig composition with armor + clothing overlays.
 *
 * The overlay pass is pure data: given a loadout + armor/clothing
 * registries, does `buildHumanRigBody` attach the right sprites to the
 * right slots and enrol them in `tintTargets`? We don't rasterise or
 * render — we just assert child counts + slot occupancy + tintTarget
 * membership, which is enough to validate the composition logic.
 *
 * The cache is an empty `Map<string, Texture>()` — missing textures are
 * fine because buildHumanRigBody tolerates them (an empty Sprite is
 * still created). What matters is the STRUCTURE of the resulting tree.
 */

function mkAppearance(): HumanAppearance {
  return {
    rig: 'human',
    skinTone: 0xc48a6a,
    hairStyle: 'short',
    hairColor: 0x3a2a1c,
    eyeColor: 0x3a2a1c,
    baseOutfit: 'fatigues',
  };
}

function mkLoadout(partial: Partial<Loadout>): Loadout {
  return {
    primaryId: 'carbine',
    primaryMods: {},
    sidearmId: 'pistol',
    sidearmMods: {},
    armorId: 'carapace',
    utilityIds: [],
    kitId: null,
    ...partial,
  };
}

describe('humanRigBody: equipment + clothing overlays', () => {
  it('base composition has five parts + four empty attachment slots when loadout is undefined', () => {
    const cache = new Map<string, Texture>();
    const comp = buildHumanRigBody(HUMAN_RIG, mkAppearance(), undefined, cache, {
      armorOf: () => undefined,
      clothingOf: () => undefined,
    });
    // All five rig parts exist.
    expect(Object.keys(comp.parts)).toHaveLength(5);
    expect(comp.parts.legs).toBeDefined();
    expect(comp.parts.torso).toBeDefined();
    expect(comp.parts.head).toBeDefined();
    expect(comp.parts['arms-back']).toBeDefined();
    expect(comp.parts['arms-front']).toBeDefined();
    // Slots exist and are empty.
    expect(comp.headSlot.children.length).toBe(0);
    expect(comp.shoulderSlotL.children.length).toBe(0);
    expect(comp.shoulderSlotR.children.length).toBe(0);
    expect(comp.backSlot.children.length).toBe(0);
    // tintTargets covers the five base parts.
    expect(comp.tintTargets.length).toBe(5);
  });

  it('armor.visual.torsoOverlay + helmet + shoulderPads attach to their slots + tintTargets', () => {
    const cache = new Map<string, Texture>();
    // Populate cache so overlays actually attach (missing textures no-op).
    const dummyTex = {} as unknown as Texture;
    cache.set('overlay:/fake/torso_overlay.svg', dummyTex);
    cache.set('overlay:/fake/helmet.svg', dummyTex);
    cache.set('overlay:/fake/shoulder_pads.svg', dummyTex);

    const armor: Armor = {
      id: 'carapace',
      name: 'Scout Carapace',
      flavor: 'Light plated vest.',
      hpBonus: 2,
      dr: 1,
      mobility: 0,
      tag: 'mundane',
      visual: {
        torsoOverlay: '/fake/torso_overlay.svg',
        helmet: '/fake/helmet.svg',
        shoulderPads: '/fake/shoulder_pads.svg',
        tint: 0x6a8a4a,
      },
    };

    const comp = buildHumanRigBody(
      HUMAN_RIG,
      mkAppearance(),
      mkLoadout({ armorId: 'carapace' }),
      cache,
      { armorOf: (id) => (id === 'carapace' ? armor : undefined), clothingOf: () => undefined },
    );

    // Helmet lands in headSlot.
    expect(comp.headSlot.children.length).toBe(1);
    // Shoulder pads — one per shoulder, mirrored.
    expect(comp.shoulderSlotL.children.length).toBe(1);
    expect(comp.shoulderSlotR.children.length).toBe(1);
    // Torso overlay is body-aligned (lives in root, not a slot). Its
    // presence is visible in the tintTargets growing past 5 base parts.
    // 5 base + 3 overlays (torso + helmet + 2 shoulders) = 9.
    expect(comp.tintTargets.length).toBe(9);
    // Armor tint applied on each overlay.
    for (const sprite of comp.tintTargets.slice(5)) {
      expect(sprite.tint).toBe(0x6a8a4a);
    }
  });

  it('clothing cloak attaches to backSlot, tabard lands body-aligned', () => {
    const cache = new Map<string, Texture>();
    const dummyTex = {} as unknown as Texture;
    cache.set('overlay:/fake/cloak.svg', dummyTex);
    cache.set('overlay:/fake/tabard.svg', dummyTex);

    const cloak: Clothing = {
      id: 'cloak',
      name: 'Grey Cloak',
      flavor: 'Practical wool.',
      layer: 'cloak',
      svg: '/fake/cloak.svg',
    };
    const tabard: Clothing = {
      id: 'tabard',
      name: 'Sigil Tabard',
      flavor: 'House colors.',
      layer: 'tabard',
      svg: '/fake/tabard.svg',
      tint: 0xc85a3a,
    };

    const comp = buildHumanRigBody(
      HUMAN_RIG,
      mkAppearance(),
      mkLoadout({ clothingIds: ['cloak', 'tabard'] }),
      cache,
      {
        armorOf: () => undefined,
        clothingOf: (id) => (id === 'cloak' ? cloak : id === 'tabard' ? tabard : undefined),
      },
    );

    // Cloak in backSlot.
    expect(comp.backSlot.children.length).toBe(1);
    // Tabard body-aligned → tintTargets has 5 base + 1 tabard + 1 cloak = 7.
    expect(comp.tintTargets.length).toBe(7);
    // Tabard tint applied.
    const tabardSprite = comp.tintTargets.find((s) => s.tint === 0xc85a3a);
    expect(tabardSprite).toBeDefined();
  });

  it('baseOutfit adds torso + legs overlays, and hair attaches to headSlot with hairColor tint', () => {
    // Phase 5c: non-equipment appearance content (outfit + hair) composites
    // before the armor/clothing pass, so an un-armored rig still has
    // clothing + hair.
    const cache = new Map<string, Texture>();
    const dummyTex = {} as unknown as Texture;
    cache.set('overlay:/fake/fatigues_torso.svg', dummyTex);
    cache.set('overlay:/fake/fatigues_legs.svg', dummyTex);
    cache.set('overlay:/fake/short_crop.svg', dummyTex);

    const appearance: HumanAppearance = {
      rig: 'human',
      skinTone: 0xc48a6a,
      hairStyle: 'short_crop',
      hairColor: 0x4a3020,
      eyeColor: 0x3a2a1c,
      baseOutfit: 'fatigues',
    };
    const comp = buildHumanRigBody(
      HUMAN_RIG,
      appearance,
      undefined,
      cache,
      {
        armorOf: () => undefined,
        clothingOf: () => undefined,
        hairStyleOf: (id) => (id === 'short_crop'
          ? { svg: '/fake/short_crop.svg' } : undefined),
        baseOutfitOf: (id) => (id === 'fatigues' ? {
          torsoSvg: '/fake/fatigues_torso.svg',
          legsSvg: '/fake/fatigues_legs.svg',
        } : undefined),
      },
    );
    // Hair lands in headSlot.
    expect(comp.headSlot.children.length).toBe(1);
    // Outfit adds 2 overlays (torso + legs). 5 base + 2 outfit + 1 hair = 8.
    expect(comp.tintTargets.length).toBe(8);
    // Hair carries the appearance.hairColor tint.
    const hairSprite = comp.headSlot.children[0] as { tint: number };
    expect(hairSprite.tint).toBe(0x4a3020);
  });
});

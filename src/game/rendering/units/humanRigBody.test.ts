import { describe, it, expect } from 'vitest';
import { buildHumanRigBody } from './humanRigBody';
import { HUMAN_RIG } from '../../../content/rigs';
import type { Armor, Clothing, HumanAppearance, Kit, Loadout } from '../../types';
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
    armor: { chest: 'carapace' },
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

  it('armor piece overlays (torso + helmet + shoulders) attach to their slots + tintTargets', () => {
    const cache = new Map<string, Texture>();
    // Populate cache so overlays actually attach (missing textures no-op).
    const dummyTex = {} as unknown as Texture;
    cache.set('overlay:/fake/torso_overlay.svg', dummyTex);
    cache.set('overlay:/fake/helmet.svg', dummyTex);
    cache.set('overlay:/fake/shoulder_pads.svg', dummyTex);

    const chest: Armor = {
      id: 'carapace_chest', name: 'Scout Carapace', flavor: 'Light plated vest.',
      slot: 'chest', hpBonus: 2, dr: 1, mobility: 0, tag: 'mundane',
      visual: { overlays: {
        torso: { svg: '/fake/torso_overlay.svg', tint: 0x6a8a4a },
      }},
    };
    const helm: Armor = {
      id: 'carapace_helm', name: 'Scout Helmet', flavor: 'Matching helm.',
      slot: 'helmet', hpBonus: 0, dr: 0, mobility: 0, tag: 'mundane',
      visual: { overlays: {
        helmet: { svg: '/fake/helmet.svg', tint: 0x6a8a4a },
      }},
    };
    const shoulders: Armor = {
      id: 'carapace_shoulders', name: 'Scout Pauldrons', flavor: 'Matching pauldrons.',
      slot: 'shoulders', hpBonus: 0, dr: 0, mobility: 0, tag: 'mundane',
      visual: { overlays: {
        'shoulder-l': { svg: '/fake/shoulder_pads.svg', tint: 0x6a8a4a },
        'shoulder-r': { svg: '/fake/shoulder_pads.svg', tint: 0x6a8a4a },
      }},
    };
    const byId: Record<string, Armor> = {
      carapace_chest: chest, carapace_helm: helm, carapace_shoulders: shoulders,
    };

    const comp = buildHumanRigBody(
      HUMAN_RIG,
      mkAppearance(),
      mkLoadout({ armor: {
        chest: 'carapace_chest', helmet: 'carapace_helm', shoulders: 'carapace_shoulders',
      }}),
      cache,
      { armorOf: (id) => byId[id], clothingOf: () => undefined },
    );

    // Helmet lands in headSlot.
    expect(comp.headSlot.children.length).toBe(1);
    // Shoulder pads — one per shoulder, mirrored.
    expect(comp.shoulderSlotL.children.length).toBe(1);
    expect(comp.shoulderSlotR.children.length).toBe(1);
    // Torso overlay is body-aligned (lives in root, not a slot). Its
    // presence is visible in the tintTargets growing past 5 base parts.
    // 5 base + 4 overlays (torso + helmet + 2 shoulders) = 9.
    expect(comp.tintTargets.length).toBe(9);
    // Armor tint applied on each overlay.
    for (const sprite of comp.tintTargets.slice(5)) {
      expect(sprite.tint).toBe(0x6a8a4a);
    }
  });

  it('pieces from different ArmorSlots compose additively onto the rig', () => {
    const cache = new Map<string, Texture>();
    const dummyTex = {} as unknown as Texture;
    cache.set('overlay:/fake/ranger_torso.svg', dummyTex);
    cache.set('overlay:/fake/heavy_helm.svg', dummyTex);
    cache.set('overlay:/fake/heavy_legs.svg', dummyTex);

    // Mix-and-match pieces from two "sets".
    const chest: Armor = {
      id: 'ranger_chest', name: 'Ranger Chest', flavor: '',
      slot: 'chest', hpBonus: 2, dr: 1, mobility: 0, tag: 'mundane',
      visual: { overlays: { torso: { svg: '/fake/ranger_torso.svg' } } },
    };
    const helm: Armor = {
      id: 'heavy_helm', name: 'Heavy Helm', flavor: '',
      slot: 'helmet', hpBonus: 1, dr: 0, mobility: 0, tag: 'mundane',
      visual: { overlays: { helmet: { svg: '/fake/heavy_helm.svg' } } },
    };
    const legs: Armor = {
      id: 'heavy_legs', name: 'Heavy Legs', flavor: '',
      slot: 'legs', hpBonus: 1, dr: 1, mobility: -1, tag: 'mundane',
      visual: { overlays: { legs: { svg: '/fake/heavy_legs.svg' } } },
    };
    const byId: Record<string, Armor> = {
      ranger_chest: chest, heavy_helm: helm, heavy_legs: legs,
    };

    const comp = buildHumanRigBody(
      HUMAN_RIG,
      mkAppearance(),
      mkLoadout({ armor: {
        chest: 'ranger_chest', helmet: 'heavy_helm', legs: 'heavy_legs',
      }}),
      cache,
      { armorOf: (id) => byId[id], clothingOf: () => undefined },
    );

    // Helmet slot populated.
    expect(comp.headSlot.children.length).toBe(1);
    // Both body-aligned overlays (torso + legs) in tintTargets past the
    // 5 base parts. 5 base + 3 = 8.
    expect(comp.tintTargets.length).toBe(8);
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

  it('z-order: zIndex buckets place torso overlay above base head, waistSlot above arms-back', () => {
    // Phase 6d — explicit zIndex buckets replace the old insertion-order
    // "addChildAt(index+1)" hack. Pin the key orderings here so a slip
    // in Z_BASE_PART / Z_BODY_OVERLAY / Z_SLOT breaks a test.
    const cache = new Map<string, Texture>();
    const dummyTex = {} as unknown as Texture;
    cache.set('overlay:/fake/torso_overlay.svg', dummyTex);

    const chest: Armor = {
      id: 'chest', name: 'Chest', flavor: '',
      slot: 'chest', hpBonus: 0, dr: 0, mobility: 0, tag: 'mundane',
      visual: { overlays: {
        torso: { svg: '/fake/torso_overlay.svg' },
      }},
    };
    const comp = buildHumanRigBody(
      HUMAN_RIG,
      mkAppearance(),
      mkLoadout({ armor: { chest: 'chest' } }),
      cache,
      { armorOf: (id) => (id === 'chest' ? chest : undefined), clothingOf: () => undefined },
    );

    // Base-part zIndexes ladder: legs → arms-back → torso → head.
    const legs = comp.parts.legs.zIndex;
    const armsBack = comp.parts['arms-back'].zIndex;
    const torso = comp.parts.torso.zIndex;
    const head = comp.parts.head.zIndex;
    expect(legs).toBeLessThan(armsBack);
    expect(armsBack).toBeLessThan(torso);
    expect(torso).toBeLessThan(head);

    // The torso OVERLAY (zIndex 45) must sit above the base head (40)
    // so armor silhouettes cover any face paint on the rig-head. Find
    // it in tintTargets (overlays are always enrolled there).
    const overlay = comp.tintTargets.find((s) =>
      s !== comp.parts.legs && s !== comp.parts.torso && s !== comp.parts.head
      && s !== comp.parts['arms-back'] && s !== comp.parts['arms-front']);
    expect(overlay).toBeDefined();
    expect(overlay!.zIndex).toBeGreaterThan(head);

    // Slot Containers are also zIndex-sorted.
    expect(comp.backSlot.zIndex).toBeLessThan(comp.waistSlot.zIndex);
    expect(comp.waistSlot.zIndex).toBeLessThan(comp.headSlot.zIndex);
  });

  it('skin-mask: a cached `overlay:${url}:skin` texture mounts a tinted companion sprite above the base part', () => {
    // When a partOverride SVG opts in via class="skin", the preloader
    // extracts a skin-only variant + caches it under the :skin key.
    // The renderer picks that up and mounts it as a second sprite
    // with appearance.skinTone tint — recolor-by-tint without double-
    // tinting the non-skin pixels of the base.
    const cache = new Map<string, Texture>();
    const dummyTex = {} as unknown as Texture;
    cache.set('overlay:/fake/kestrel_head.svg', dummyTex);
    cache.set('overlay:/fake/kestrel_head.svg:skin', dummyTex);

    const appearance: HumanAppearance = {
      rig: 'human',
      skinTone: 0x6a4030,           // deep — clearly not the authored color
      hairStyle: 'short_crop',
      hairColor: 0x1a1410,
      eyeColor: 0x3a2a1c,
      baseOutfit: 'fatigues',
      partOverrides: {
        head: '/fake/kestrel_head.svg',
      },
    };

    const comp = buildHumanRigBody(
      HUMAN_RIG, appearance, mkLoadout({}), cache,
      { armorOf: () => undefined, clothingOf: () => undefined },
    );

    // 5 base parts + 1 skin-mask companion sprite = 6.
    expect(comp.tintTargets.length).toBe(6);
    // The companion sprite carries the skinTone tint.
    const skinSprite = comp.tintTargets.find((s) =>
      s !== comp.parts.legs && s !== comp.parts.torso && s !== comp.parts.head
      && s !== comp.parts['arms-back'] && s !== comp.parts['arms-front']);
    expect(skinSprite).toBeDefined();
    expect(skinSprite!.tint).toBe(0x6a4030);
    // zIndex sits just above the head base part (40 + 0.5 = 40.5).
    expect(skinSprite!.zIndex).toBe(comp.parts.head.zIndex + 0.5);
  });

  it('skin-mask: override without a cached :skin texture renders no extra sprite', () => {
    // Non-opt-in SVGs (no class="skin") don't get a :skin cache entry
    // from the preloader. Renderer should not add a companion sprite.
    const cache = new Map<string, Texture>();
    const dummyTex = {} as unknown as Texture;
    cache.set('overlay:/fake/no_skin.svg', dummyTex);
    // No :skin entry seeded.

    const appearance: HumanAppearance = {
      rig: 'human',
      skinTone: 0x6a4030,
      hairStyle: 'short_crop',
      hairColor: 0x1a1410,
      eyeColor: 0x3a2a1c,
      baseOutfit: 'fatigues',
      partOverrides: { head: '/fake/no_skin.svg' },
    };
    const comp = buildHumanRigBody(
      HUMAN_RIG, appearance, mkLoadout({}), cache,
      { armorOf: () => undefined, clothingOf: () => undefined },
    );
    // 5 base parts only — no companion sprite.
    expect(comp.tintTargets.length).toBe(5);
  });

  it('kit.visual.overlays composite onto the rig alongside armor', () => {
    // Phase 6c — Kit gained an optional Visual field. Kit overlays
    // share the same BodySlot vocabulary as armor pieces; the renderer
    // walks them in a pass that mirrors the armor loop. Belt slot
    // currently anchors to backSlot (a 6d cleanup replaces this with a
    // dedicated waist slot).
    const cache = new Map<string, Texture>();
    const dummyTex = {} as unknown as Texture;
    cache.set('overlay:/fake/webbing.svg', dummyTex);

    const kit: Kit = {
      id: 'salvagers_webbing',
      name: "Salvager's Webbing",
      flavor: '',
      effects: { extraAmmoPrimary: 2 },
      tag: 'mundane',
      visual: { overlays: {
        belt: { svg: '/fake/webbing.svg', tint: 0x8a6a48 },
      }},
    };

    const comp = buildHumanRigBody(
      HUMAN_RIG,
      mkAppearance(),
      mkLoadout({ kitId: 'salvagers_webbing' }),
      cache,
      {
        armorOf: () => undefined,
        clothingOf: () => undefined,
        kitOf: (id) => (id === 'salvagers_webbing' ? kit : undefined),
      },
    );

    // Belt overlays land in the dedicated waistSlot (6d).
    expect(comp.waistSlot.children.length).toBe(1);
    // 5 base + 1 kit overlay = 6.
    expect(comp.tintTargets.length).toBe(6);
    // Kit tint applied.
    const attached = comp.waistSlot.children[0] as { tint: number };
    expect(attached.tint).toBe(0x8a6a48);
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

  it('gauntlet-front overlay child anchor matches GRIP_ANCHOR so it rides with the post-attach re-anchor in UnitNode', async () => {
    // Regression pin. arms-front starts at anchor (0,0) but UnitNode
    // re-anchors it to GRIP_ANCHOR after buildHumanRigBody returns.
    // Pixi children don't follow anchor changes, so the child must
    // author its own anchor to match — otherwise it shifts ~one iso
    // tile SE of the hand and shows as a ghost silhouette on the ground.
    const { GRIP_ANCHOR } = await import('./constants');
    const cache = new Map<string, Texture>();
    const dummyTex = {} as unknown as Texture;
    cache.set('overlay:/fake/gauntlets_front.svg', dummyTex);

    const gauntlets: Armor = {
      id: 'test_gauntlets', name: 'Test Gauntlets', flavor: 'Pin.',
      slot: 'gauntlets', hpBonus: 0, dr: 0, mobility: 0, tag: 'mundane',
      visual: { overlays: {
        'gauntlet-front': { svg: '/fake/gauntlets_front.svg' },
      }},
    };

    const comp = buildHumanRigBody(
      HUMAN_RIG,
      mkAppearance(),
      mkLoadout({ armor: { gauntlets: 'test_gauntlets' } }),
      cache,
      { armorOf: (id) => (id === 'test_gauntlets' ? gauntlets : undefined), clothingOf: () => undefined },
    );

    const armsFront = comp.parts['arms-front'];
    expect(armsFront.children.length).toBe(1);
    const child = armsFront.children[0] as unknown as { anchor: { x: number; y: number } };
    expect(child.anchor.x).toBe(GRIP_ANCHOR.x);
    expect(child.anchor.y).toBe(GRIP_ANCHOR.y);
  });
});

import { Assets, Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import { useCombatStore } from '../../../state/combatStore';
import { getArmor, getClothing, useContent } from '../../../content/registry';
import type { Unit, UnitId, Vec2 } from '../../types';
import { gridToScreen } from '../isoProjection';
import { spriteCache } from '../context';
import { GRIP_ANCHOR, HIT_FLASH_MS, MOVE_TWEEN_MS } from './constants';
import { FIRE_STYLES, type FireStyle } from './fireStyles';
import { buildHumanRigBody, overlayCacheKey, type RigBodyComposition } from './humanRigBody';
import { allRigs, rigById, rigPartSvg } from '../../../content/rigs';

/**
 * Per-unit render node. Persists across store updates so animations
 * (walk cycle, selection pulse, fire sequence, hit flash, death fade)
 * can tween continuously without being torn down each frame.
 *
 * Layer order inside `container`:
 *   shadow (flat) → selectionRing (flat) → body (rotates/scales) → muzzleFlash
 *   → ornaments → hpBar → label
 *
 * `body` holds the sprite and gets all rotation / scale / facing-flip. The
 * shadow and UI chrome stay on the container so they don't lean when the
 * character does.
 */
export type UnitNode = {
  container: Container;
  shadow: Graphics;
  body: Container;
  sprite: Sprite | null;
  fallback: Graphics | null;
  /**
   * Weapon wrap: Container holding the weapon sprite + muzzle flash. Rotates
   * around the character's grip point so the weapon "raises" / "recoils"
   * independently of the body sway.
   */
  weaponWrap: Container | null;
  weaponSprite: Sprite | null;
  /** Arms sprite, lives inside the weapon wrap so it moves with the gun. */
  armsSprite: Sprite | null;
  /** Y position of the weapon wrap at rest (low-ready). Fire animations
   * lift from this value toward eye level and return to it. */
  weaponRestY: number;
  muzzleFlash: Graphics;
  hpBar: Graphics;
  label: Text;
  ornaments: Container;
  selectionRing: Graphics;
  spriteTop: number;

  // Movement tween — screen-space, measured in world coords (pre-camera).
  currentScreen: { x: number; y: number };
  targetScreen: { x: number; y: number };
  moveMs: number;
  moveDurationMs: number;

  // Visual state.
  facing: 1 | -1;
  prevHp: number;
  /** Composite tint reflecting accumulated grime on the unit. Starts at
   * 0xffffff (clean) and shifts toward a dusty brown as Unit.dirt rises. */
  dirtTint: number;
  hitFlashMs: number;
  fireAnimMs: number;                   // countdown for fire sequence.
  fireStyle: FireStyle;                 // per-weapon-class choreography.
  fireTargetDir: { x: number; y: number }; // unit vector toward the shot target.
  deathMs: number | null;
  selected: boolean;
  bobPhase: number;
  /** Rig composition when the unit was built from HumanAppearance.
   *  Null for bespoke-SVG units. animate.ts and future equipment
   *  overlay passes reach named parts through this. */
  rigComposition: RigBodyComposition | null;
  /** Cached loadoutVersion the current rigComposition was built for.
   *  updateUnitNode compares against u.loadoutVersion and rebuilds the
   *  overlays on mismatch. Undefined means "never seen a version" — the
   *  first updateUnitNode will initialise it without triggering a rebuild
   *  (the initial createUnitNode already composed for the current version). */
  lastLoadoutVersion?: number;
};

/**
 * Preload body + weapon textures for every templateId the pack provides
 * a resolver for. Cache keys are `${templateId}:body` | `:arms` | `:weapon`
 * and `w:${weaponId}` for pack-level weapon sprites. Missing / failing URLs
 * are non-fatal — the renderer falls back to a body-only sprite (or the
 * placeholder rectangle) when a weapon is absent.
 */
export async function ensureSpritesLoaded(pack: ReturnType<typeof useContent>): Promise<void> {
  const bodyResolve = pack.theme?.spritePath;
  const armsResolve = pack.theme?.armsPath;
  const weaponResolve = pack.theme?.weaponPath;
  const templates = [...Object.keys(pack.soldierTemplates), ...Object.keys(pack.enemyTemplates)];
  const loads: Array<Promise<void>> = [];
  const pushLoad = (key: string, url: string | undefined) => {
    if (!url || spriteCache.has(key)) return;
    loads.push((async () => {
      try {
        const tex = await Assets.load<Texture>(url);
        spriteCache.set(key, tex);
      } catch (err) {
        console.warn(`[sprites] failed to load ${key} from ${url}`, err);
      }
    })());
  };
  // Per-template body / arms / template-owned weapon (enemies).
  for (const id of templates) {
    pushLoad(`${id}:body`, bodyResolve?.(id));
    pushLoad(`${id}:arms`, armsResolve?.(id));
    pushLoad(`${id}:weapon`, weaponResolve?.(id));
  }
  // Weapon sprites keyed by weapon id — same weapon looks the same on any
  // wielder. Players resolve their weapon texture via this cache at node
  // creation, letting two soldiers holding the same carbine render with
  // the identical visual.
  for (const w of Object.values(pack.weapons)) {
    if (w.spritePath) pushLoad(`w:${w.id}`, w.spritePath);
  }
  // Rig part SVGs — one pass per registered rig, preloaded under keys
  // `rig:${rigId}:${partId}` (e.g. `rig:human:torso`). Missing part URLs
  // are non-fatal; the rig path falls through to an empty Sprite for
  // that part (same tolerance the bespoke path has for missing body
  // SVGs). This lets a pack ship a partial rig during authoring.
  for (const rig of allRigs()) {
    for (const partId of rig.parts) {
      pushLoad(`rig:${rig.id}:${partId}`, rigPartSvg(rig.id, partId));
    }
  }
  // Armor + clothing overlay SVGs — keyed by `overlay:${url}` so the
  // rig composition's addBodyAlignedOverlay / addSlotOverlay helpers
  // can look them up without re-deriving the key shape.
  for (const armor of Object.values(pack.armor)) {
    const overlays = armor.visual?.overlays;
    if (!overlays) continue;
    for (const layer of Object.values(overlays)) {
      if (layer) pushLoad(overlayCacheKey(layer.svg), layer.svg);
    }
  }
  if (pack.clothing) {
    for (const c of Object.values(pack.clothing)) {
      pushLoad(overlayCacheKey(c.svg), c.svg);
    }
  }
  // Rig appearance catalogs — hair styles + base outfits. Preloaded
  // under the same `overlay:${url}` key shape so buildHumanRigBody's
  // lookup works without branching on asset kind.
  if (pack.hairStyles) {
    for (const h of Object.values(pack.hairStyles)) {
      pushLoad(overlayCacheKey(h.svg), h.svg);
    }
  }
  if (pack.baseOutfits) {
    for (const o of Object.values(pack.baseOutfits)) {
      pushLoad(overlayCacheKey(o.torsoSvg), o.torsoSvg);
      pushLoad(overlayCacheKey(o.legsSvg), o.legsSvg);
    }
  }
  // Per-soldier rig-part overrides. Each soldier template that sets
  // appearance.partOverrides contributes a handful of URLs that
  // substitute for the shared rig parts at composition time. Cached
  // under overlay:${url} matching the key shape buildHumanRigBody
  // checks for overridden parts.
  for (const s of Object.values(pack.soldierTemplates)) {
    const overrides = s.appearance?.partOverrides;
    if (!overrides) continue;
    for (const url of Object.values(overrides)) {
      if (url) pushLoad(overlayCacheKey(url), url);
    }
  }
  for (const e of Object.values(pack.enemyTemplates)) {
    const overrides = e.appearance?.partOverrides;
    if (!overrides) continue;
    for (const url of Object.values(overrides)) {
      if (url) pushLoad(overlayCacheKey(url), url);
    }
  }
  await Promise.all(loads);
}

/**
 * Reconcile `unitNodes` against the store's unit list:
 *  - Create a persistent node for any new unit.
 *  - Update per-unit visual state (HP bar, ornaments, facing, animation triggers).
 *  - Start movement tween when grid position changes.
 *  - Trigger hit flash when HP drops, death fade when alive→false.
 *
 * The ticker drives the actual frame-by-frame interpolation.
 */
export function syncUnits(
  layer: Container,
  nodes: Map<UnitId, UnitNode>,
  st: ReturnType<typeof useCombatStore.getState>,
  onHit?: (pos: Vec2, damage: number) => void,
) {
  const seen = new Set<UnitId>();
  for (const u of st.units) {
    seen.add(u.id);
    let node = nodes.get(u.id);
    if (!node) {
      node = createUnitNode(u);
      layer.addChild(node.container);
      nodes.set(u.id, node);
    }
    updateUnitNode(node, u, u.id === st.selectedId, onHit);
  }
  // Units dropped by initMission — destroy their nodes outright.
  for (const [id, node] of nodes) {
    if (seen.has(id)) continue;
    layer.removeChild(node.container);
    node.container.destroy({ children: true });
    nodes.delete(id);
  }
}

function createUnitNode(u: Unit): UnitNode {
  const container = new Container();

  // Shadow is a child of container (not body) so it doesn't lean during
  // walk/fire. Warm brown (rather than pure black) on desert/refinery
  // maps so the shadow reads as dust-on-sand instead of floating ink.
  const shadow = new Graphics();
  const tileset = useCombatStore.getState().map.tileset;
  const shadowColor = (tileset === 'desert' || tileset === 'desert-refinery')
    ? 0x2a1a0a : 0x050709;
  shadow.ellipse(0, 6, 14, 6).fill({ color: shadowColor, alpha: 0.55 });

  const selectionRing = new Graphics();

  // Body holds the sprite — this is what rotates/scales during walk cycles.
  const body = new Container();

  let sprite: Sprite | null = null;
  let fallback: Graphics | null = null;
  let weaponWrap: Container | null = null;
  let weaponSprite: Sprite | null = null;
  let armsSprite: Sprite | null = null;
  let weaponRestY = 0;
  let spriteTop: number;
  let rigComposition: RigBodyComposition | null = null;

  // Players resolve their weapon sprite by the EQUIPPED weapon's id so the
  // same weapon renders identically on any wielder. Enemies (no loadout)
  // keep the per-template weapon — their weapon is part of their identity.
  const playerWeaponId = u.loadout?.primaryId;
  const weaponTex =
    (playerWeaponId && spriteCache.get(`w:${playerWeaponId}`)) ??
    spriteCache.get(`${u.templateId}:weapon`);

  // Rig-composed path: when the unit carries a HumanAppearance, build the
  // body from the rig's five named parts instead of the single monolithic
  // torso sprite. The weapon wrap is constructed the same way as the
  // bespoke path, but the rig's `arms-front` part lives inside it (taking
  // the place the legacy `armsSprite` used to occupy) so it rides with
  // the weapon grip for aim + recoil.
  const rig = u.appearance ? rigById(u.appearance.rig) : undefined;
  if (rig && u.appearance) {
    rigComposition = buildHumanRigBody(rig, u.appearance, u.loadout, spriteCache, {
      armorOf: (id) => {
        try { return getArmor(id); } catch { return undefined; }
      },
      clothingOf: getClothing,
      hairStyleOf: (id) => useContent().hairStyles?.[id],
      baseOutfitOf: (id) => useContent().baseOutfits?.[id],
    });
    body.addChild(rigComposition.root);
    // spriteTop matches the bespoke-path value so ornaments / HP bar /
    // label land at the same offset above the character.
    spriteTop = -50;

    const glint = new Graphics();
    glint.moveTo(5, -42);
    glint.quadraticCurveTo(9, -40, 7, -36);
    glint.stroke({ color: 0xe8c488, width: 1.2, alpha: 0.75 });
    body.addChild(glint);

    if (weaponTex) {
      weaponWrap = new Container();
      weaponRestY = (GRIP_ANCHOR.y - 1) * 128 * 0.42 + 4;
      weaponWrap.position.set(0, weaponRestY);

      // arms-front IS the rig's front-arm sprite — parent it into the
      // weapon wrap so it rotates + lifts with the weapon. This replaces
      // the legacy `armsSprite` that the bespoke path creates here.
      armsSprite = rigComposition.armsFront;
      armsSprite.anchor.set(GRIP_ANCHOR.x, GRIP_ANCHOR.y);
      armsSprite.scale.set(0.42);
      armsSprite.position.set(0, 0);
      weaponWrap.addChild(armsSprite);

      weaponSprite = new Sprite(weaponTex);
      weaponSprite.anchor.set(GRIP_ANCHOR.x, GRIP_ANCHOR.y);
      weaponSprite.scale.set(0.42);
      weaponWrap.addChild(weaponSprite);
      body.addChild(weaponWrap);
      rigComposition.tintTargets.push(weaponSprite);
    }
  } else {
  const bodyTex = spriteCache.get(`${u.templateId}:body`);
  const armsTex = spriteCache.get(`${u.templateId}:arms`);
  if (bodyTex) {
    sprite = new Sprite(bodyTex);
    sprite.anchor.set(0.5, 1);
    sprite.scale.set(0.42);
    sprite.position.set(0, 4);
    body.addChild(sprite);
    spriteTop = -50;

    // Sun-glint rim: a short gold stroke on the upper-right of the body
    // (roughly helmet / pauldron height). Baked into the body container
    // so it inherits walk-lean / fire-pitch rotation.
    const glint = new Graphics();
    glint.moveTo(5, -42);
    glint.quadraticCurveTo(9, -40, 7, -36);
    glint.stroke({ color: 0xe8c488, width: 1.2, alpha: 0.75 });
    body.addChild(glint);

    // Weapon rides on top of the body. We use a wrap whose origin sits at the
    // character's grip — rotating the wrap then pivots the weapon around the
    // hand. The weapon sprite is anchored at GRIP_ANCHOR so its internal
    // coordinates stay aligned with the body's 96×128 viewBox.
    if (weaponTex) {
      weaponWrap = new Container();
      // Grip viewBox coords = (GRIP_ANCHOR.x*96, GRIP_ANCHOR.y*128). Body
      // sprite renders viewBox → local via anchor (0.5, 1) at position (0, 4),
      // so grip local = ((0.5-0.5)*96*0.42, (0.56-1)*128*0.42 + 4) = (0, -19.64).
      weaponRestY = (GRIP_ANCHOR.y - 1) * 128 * 0.42 + 4;
      weaponWrap.position.set(0, weaponRestY);

      if (armsTex) {
        armsSprite = new Sprite(armsTex);
        armsSprite.anchor.set(GRIP_ANCHOR.x, GRIP_ANCHOR.y);
        armsSprite.scale.set(0.42);
        weaponWrap.addChild(armsSprite);
      }

      weaponSprite = new Sprite(weaponTex);
      weaponSprite.anchor.set(GRIP_ANCHOR.x, GRIP_ANCHOR.y);
      weaponSprite.scale.set(0.42);
      weaponWrap.addChild(weaponSprite);
      body.addChild(weaponWrap);
    }
  } else {
    fallback = new Graphics();
    const color = parseInt(u.color.slice(1), 16);
    fallback.roundRect(-10, -30, 20, 30, 4).fill(color).stroke({ color: 0x0b0f14, width: 1 });
    fallback.circle(0, -36, 8).fill(color).stroke({ color: 0x0b0f14, width: 1 });
    body.addChild(fallback);
    spriteTop = -44;
  }
  } // end bespoke-SVG path

  // Muzzle flash is a child of the weapon wrap (when present) so it rotates
  // with the weapon and sits at the barrel tip. When there's no weapon wrap
  // it attaches to the container directly as a fallback.
  const muzzleFlash = new Graphics();
  if (weaponWrap) weaponWrap.addChild(muzzleFlash);

  const hpBar = new Graphics();
  const label = new Text({
    text: '',
    style: { fill: 0xaab4c4, fontSize: 10, fontFamily: 'system-ui' },
  });
  label.anchor.set(0.5, 1);
  const ornaments = new Container();

  if (weaponWrap) {
    container.addChild(shadow, selectionRing, body, ornaments, hpBar, label);
  } else {
    container.addChild(shadow, selectionRing, body, muzzleFlash, ornaments, hpBar, label);
  }

  const p = gridToScreen(u.pos);
  container.position.set(p.x, p.y);

  return {
    container, shadow, body, sprite, fallback, weaponWrap, weaponSprite, armsSprite,
    weaponRestY, muzzleFlash,
    hpBar, label, ornaments, selectionRing, spriteTop,
    currentScreen: { x: p.x, y: p.y },
    targetScreen: { x: p.x, y: p.y },
    moveMs: 0, moveDurationMs: 0,
    facing: 1,
    prevHp: u.hp,
    dirtTint: tintForDirt(u.dirt ?? 0),
    hitFlashMs: 0,
    fireAnimMs: 0,
    fireStyle: FIRE_STYLES.default,
    fireTargetDir: { x: 1, y: 0 },
    deathMs: u.alive ? null : 0,
    selected: false,
    bobPhase: Math.random() * Math.PI * 2,
    rigComposition,
    lastLoadoutVersion: u.loadoutVersion,
  };
}

/**
 * Rebuild a rig-composed unit's overlay tree when its loadout changes
 * mid-mission. The base rig parts (head / torso / etc.) are preserved;
 * only armor/clothing overlays + the skin tint are torn down and
 * recomposed. Cheap: a few sprite swaps, no UnitNode shell touched.
 *
 * Called from updateUnitNode when it detects u.loadoutVersion has
 * advanced past node.lastLoadoutVersion.
 */
function rebuildRigOverlays(node: UnitNode, u: Unit): void {
  if (!node.rigComposition || !u.appearance) return;
  const rig = rigById(u.appearance.rig);
  if (!rig) return;

  // Tear down the existing composition's children + overlays, keeping
  // the UnitNode's body Container + weapon wrap + muzzle flash intact.
  node.rigComposition.root.destroy({ children: true });
  // arms-front lives inside the weapon wrap; destroy it too so the new
  // composition can install a fresh armsFront sprite.
  if (node.armsSprite) {
    node.weaponWrap?.removeChild(node.armsSprite);
    node.armsSprite.destroy();
  }

  const fresh = buildHumanRigBody(rig, u.appearance, u.loadout, spriteCache, {
    armorOf: (id) => {
      try { return getArmor(id); } catch { return undefined; }
    },
    clothingOf: getClothing,
  });
  node.body.addChild(fresh.root);
  // Re-install armsFront in the weapon wrap if we have one. Anchor +
  // scale + position match the createUnitNode initial installation.
  if (node.weaponWrap) {
    node.armsSprite = fresh.armsFront;
    node.armsSprite.anchor.set(GRIP_ANCHOR.x, GRIP_ANCHOR.y);
    node.armsSprite.scale.set(0.42);
    node.armsSprite.position.set(0, 0);
    node.weaponWrap.addChild(node.armsSprite);
    // The weapon sprite survives the rebuild but we need it back in the
    // tintTargets list because it used to be in the old composition's.
    if (node.weaponSprite) fresh.tintTargets.push(node.weaponSprite);
  }
  node.rigComposition = fresh;
}

function updateUnitNode(
  node: UnitNode, u: Unit, selected: boolean,
  onHit?: (pos: Vec2, damage: number) => void,
) {
  // ---- Loadout change: rig-composed units rebuild overlay sprites when
  // their loadoutVersion advances (currently triggered by tryRefit).
  if (node.rigComposition && u.loadoutVersion !== node.lastLoadoutVersion) {
    rebuildRigOverlays(node, u);
    node.lastLoadoutVersion = u.loadoutVersion;
  }

  // ---- Movement: grid position changed → tween from wherever we're rendered now.
  const target = gridToScreen(u.pos);
  if (target.x !== node.targetScreen.x || target.y !== node.targetScreen.y) {
    node.currentScreen = { x: node.container.position.x, y: node.container.position.y };
    node.targetScreen = { x: target.x, y: target.y };
    node.moveMs = 0;
    node.moveDurationMs = MOVE_TWEEN_MS;
    const dx = target.x - node.currentScreen.x;
    if (Math.abs(dx) > 0.5) node.facing = dx > 0 ? 1 : -1;
  }

  // ---- Hit: HP dropped this sync → flash red + jitter + spurt blood.
  if (u.hp < node.prevHp) {
    node.hitFlashMs = HIT_FLASH_MS;
    if (onHit) onHit(u.pos, node.prevHp - u.hp);
  }
  node.prevHp = u.hp;

  // ---- Grime: recompute the dirt tint each sync so mid-mission cleans
  // (future Field Wash consumable) show instantly, and so newly spawned
  // units pick up their excursion-accumulated dirt at mission start.
  node.dirtTint = tintForDirt(u.dirt ?? 0);

  // (Fire-animation triggers are driven by FireEvent stream — see
  // applyFireEvents in fireStyles.ts. Ammo tracking is not needed here.)

  // ---- Death: transition to dying once, then let the ticker animate the fade.
  if (!u.alive && node.deathMs === null) node.deathMs = 0;

  // ---- HP bar.
  const pct = Math.max(0, u.hp) / u.hpMax;
  const barY = node.spriteTop - 12;
  node.hpBar.clear();
  if (u.alive) {
    node.hpBar.rect(-14, barY, 28, 4).fill(0x0b0f14);
    node.hpBar.rect(-14, barY, 28 * pct, 4).fill(u.faction === 'player' ? 0x57d18b : 0xff5a6a);
  }

  // ---- Label.
  node.label.text = u.faction === 'player' ? `${u.name} ${u.ap}/${u.apMax}` : u.name;
  node.label.position.set(0, barY - 4);
  node.label.visible = u.alive;

  // ---- Ornaments (overwatch, blinded, suppressed, marked, see-through-smoke).
  node.ornaments.removeChildren();
  if (u.alive && u.status.overwatch) {
    const ow = new Graphics();
    ow.circle(0, node.spriteTop - 10, 4).fill(0xf5c55a);
    node.ornaments.addChild(ow);
  }
  if (u.alive && u.status.blinded) {
    const bl = new Graphics();
    bl.circle(-6, node.spriteTop - 10, 3).fill(0xc79aff);
    bl.circle(6, node.spriteTop - 10, 3).fill(0xc79aff);
    node.ornaments.addChild(bl);
  }
  if (u.alive && u.status.suppressed) {
    // Three downward-pointing orange triangles — "head down" cue.
    const sp = new Graphics();
    for (let i = -1; i <= 1; i++) {
      const cx = i * 6;
      sp.poly([cx - 3, node.spriteTop - 12, cx + 3, node.spriteTop - 12, cx, node.spriteTop - 6])
        .fill(0xff9a3c);
    }
    node.ornaments.addChild(sp);
  }
  if (u.alive && u.status.marked) {
    // Red diamond reticle with a crosshair — Ranger's marked-for-death cue.
    const mk = new Graphics();
    const cy = node.spriteTop - 14;
    mk.poly([-5, cy, 0, cy - 5, 5, cy, 0, cy + 5])
      .stroke({ color: 0xff5a6a, width: 1.4 });
    mk.moveTo(-7, cy); mk.lineTo(-3, cy); mk.stroke({ color: 0xff5a6a, width: 1 });
    mk.moveTo(3, cy); mk.lineTo(7, cy); mk.stroke({ color: 0xff5a6a, width: 1 });
    node.ornaments.addChild(mk);
  }
  if (u.alive && u.status.seeThroughSmoke) {
    // Violet rune above head — Mystic's Arcane Sight cue.
    const asg = new Graphics();
    asg.circle(0, node.spriteTop - 14, 3.5).stroke({ color: 0xc79aff, width: 1.2 });
    asg.circle(0, node.spriteTop - 14, 1).fill(0xeaf6ff);
    node.ornaments.addChild(asg);
  }

  // ---- Selection ring: gold accent matches the HUD's "active" colour.
  node.selectionRing.clear();
  if (selected && u.alive) {
    node.selectionRing.ellipse(0, 6, 18, 8).stroke({ color: 0xe8c488, width: 2 });
  }
  node.selected = selected;

  // ---- Iso depth sort.
  node.container.zIndex = u.pos.x + u.pos.y;
}

/**
 * Convert a 0..100 dirt score into a multiplicative sprite tint — shifts
 * white toward dusty brown (#b4986a) as dirt climbs. Capped at dirt=100
 * which still leaves ~60% of each channel intact so the character stays
 * readable through the grime.
 */
export function tintForDirt(dirt: number): number {
  const t = Math.max(0, Math.min(1, dirt / 100));
  if (t === 0) return 0xffffff;
  // Lerp white (255,255,255) → dusty brown (180,152,106).
  const r = Math.round(255 + (180 - 255) * t);
  const g = Math.round(255 + (152 - 255) * t);
  const b = Math.round(255 + (106 - 255) * t);
  return (r << 16) | (g << 8) | b;
}

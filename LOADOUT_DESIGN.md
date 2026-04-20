# Loadout & Modification Design

Proposal for expanding the existing per-soldier loadout into a deeper customization system. Design-only; no code changes yet.

---

## Goal

Make every soldier feel meaningfully different mission-to-mission. Today the loadout screen lets you pick **primary, sidearm, armor, and 2 utilities**. The new system extends that with:

1. A new **Gear** slot for passive equipment (no AP cost, always-on).
2. A **Weapon Modification** sub-system: each weapon has 4 attachment slots (optic, magazine, muzzle, stock) that stack with the base weapon.
3. A larger armor / utility / sidearm catalog so the existing slots have real choice.
4. A single screen reorganized around **tabs + drilldown** so it stays mobile-readable.

---

## Pillars

- **Choice over count.** 4 strong options per slot beats 12 muddled ones. Every option should change *how* you play, not just shift a number.
- **Tag-coloured identity.** Every item carries an `ElementTag` (`runic` / `draconic` / `alchemical` / `fae` / `mundane`). Mods inherit colour from their tag so synergies are visually obvious.
- **Weapon as a build.** A Runeweave Carbine with a Marksman Scope + Drum Mag is a different gun than the same carbine with a Suppressor + Foregrip. The combat preview already breaks down hit% — mods slot into that breakdown directly.
- **Mobile-first UI.** No nested forms. A slot is one tap to open, one tap to pick.

---

## Slot taxonomy

| Category | Current | Expanded |
|---|---|---|
| **Weapons** | Primary, Sidearm | Primary + Sidearm, each with 4 mod slots |
| **Armor** | 1 piece | 1 piece (catalog grows; single-slot stays for clarity) |
| **Gear** | — | 1 passive item (NEW) |
| **Utilities** | up to 2 throwables | up to 2 throwables (charge counts already wired) |

> Multi-slot armor (helmet/chest/legs) was considered and rejected — too many decisions to make per mission for a tactical-game pace. Keep armor as one cohesive choice; let mods carry the deep customization.

---

## Weapon modification system

Each weapon has **4 attachment slots**. A mod fits a slot if its `slot` matches and the weapon's `class` is in the mod's `fits[]` list. Effects stack additively onto the base weapon.

| Slot | Affects | Sample mods |
|---|---|---|
| **Optic** | aim, crit, vision range | Iron Sights · Tactical Reflex (+5 aim short) · Marksman Scope (+15 aim long, −5 short) · Thermal HUD (sees through smoke) · Targeting Sigil (+10 crit) |
| **Magazine** | ammo, dmg, reload cost | Standard · Extended Mag (+2 ammo, −1 mob) · Drum Mag (+4 ammo, −10 aim) · Sigil Rounds (+1 dmg) · Piercing Rounds (ignore 2 DR, −1 dmg) |
| **Muzzle** | range, dmg, special | Bare · Suppressor (no range falloff, −1 dmg) · Compensator (+5 crit) · Rune Catalyzer (+1 dmg of weapon's tag) · Flash Hider (less visible at night) |
| **Stock** | mobility, aim, special | Standard · Folding Stock (+1 mob, −5 aim) · Heavy Stock (+5 aim, −1 mob) · Reactive Grip (recover 1 ammo on crit) · Ceremonial Engraving (+2 crit, +5% miss when out of ammo) |

**Combat math.** During `previewShot`:
1. Resolve `effectiveWeapon = base ⊕ mods.optic ⊕ mods.magazine ⊕ mods.muzzle ⊕ mods.stock`.
2. Plug `effectiveWeapon` into the existing modifier-stack formula.
3. The shot-preview card already lists modifier rows — mods just add named contributions to that list (`+5 Marksman Scope`, `−10 Drum Mag aim`).

This keeps `combat.ts` clean — only the resolver function changes; the preview/result code is untouched.

---

## Gear (new passive slot)

One always-on item per soldier. No AP cost. Sample catalog (4–6 to ship with):

| Gear | Effect |
|---|---|
| **Salvager's Webbing** | +2 ammo to primary, +1 ammo to sidearm at mission start |
| **Whisperstep Boots** | +1 mobility |
| **Warding Charm** | First incoming hit per mission deals −2 damage |
| **Spotter's Lens** | +5 aim when shooting at any flanked target |
| **Combat Stims** | Once per mission, restore 1 AP (manual activation) |
| **Field Surgeon Kit** | Adjacent allies regenerate 1 HP at start of player turn |

Gear isn't tag-restricted — any soldier can wear any piece, but the *flavour* hints which class benefits most (Whisperstep on a Mystic, Warding Charm on a Warden, etc.).

---

## UI flow (mobile-friendly)

```
┌──────────────────────────────┐
│ ← Back                Deploy │  fixed top bar
├──────────────────────────────┤
│ [Kestrel] Brannock  Sera Orin │  soldier carousel (chips)
├──────────────────────────────┤
│ ┌─────┐ Kestrel · Ranger     │  large soldier card
│ │ 🛡️ │ HP 12  AIM +10  MOB 4 │  derived stats live-update
│ └─────┘                      │
├──────────────────────────────┤
│ 🔫 Weapons  🛡️ Armor  🎒 Gear  💣 Util │  TABS
├──────────────────────────────┤
│  ▼ Primary                    │  expandable section
│   [Runeweave Carbine] ▷       │  tap → weapon picker modal
│   ┌─────────┬─────────┐       │
│   │ Optic   │ Mag     │       │  mod slots beneath weapon
│   │ Reflex  │ Drum    │       │  tap → mod picker modal
│   ├─────────┼─────────┤       │
│   │ Muzzle  │ Stock   │       │
│   │ Suppr.  │ Standard│       │
│   └─────────┴─────────┘       │
│  ▼ Sidearm                    │
│   ... same pattern            │
└──────────────────────────────┘
```

- **Carousel** on top stays sticky; tap a soldier to switch.
- **Tabs** swap which section is showing; default to Weapons.
- **Each slot** is a card with the current item name. Tapping opens a fullscreen picker modal — vertical list with name / stats / flavour / "EQUIP" button.
- **Mod slots** show only when a weapon is equipped. Empty mod slots show as dashed "+ Optic" placeholders.
- The right-side **stat panel** previews the diff *before* you commit (`AIM 65 → 75`, `MOB 4 → 3`).

---

## Data model

```ts
// New: weapon mod
export type ModSlot = 'optic' | 'magazine' | 'muzzle' | 'stock';

export type WeaponMod = {
  id: string;
  name: string;
  flavor: string;
  slot: ModSlot;
  fits: WeaponClass[];           // which weapon classes accept this mod
  effects: Partial<{
    aim: number; crit: number;
    dmgMin: number; dmgMax: number;
    rangeShort: number; rangeLong: number;
    ammo: number; apCost: number;
    mobility: number;            // applied to wielder
    flags: WeaponFlag[];         // 'silenced' | 'thermal' | 'piercing' | ...
  }>;
  tag: ElementTag;
};

export type WeaponFlag = 'silenced' | 'thermal' | 'piercing';

// New: gear
export type Gear = {
  id: string;
  name: string;
  flavor: string;
  effects: Partial<{
    hpBonus: number; mobilityBonus: number; aimBonus: number;
    extraAmmoPrimary: number; extraAmmoSidearm: number;
    visionRange: number;
    onCritRecoverAmmo: boolean;
    firstHitReduction: number;
  }>;
  tag: ElementTag;
};

// Loadout (extended)
export type Loadout = {
  primaryId: string;
  primaryMods: Partial<Record<ModSlot, string>>;
  sidearmId: string;
  sidearmMods: Partial<Record<ModSlot, string>>;
  armorId: string;
  gearId: string | null;
  utilityIds: string[];
};
```

`primaryMods` defaults to `{}` — empty slots are just unused. Backwards-compatible with the existing persisted loadouts (missing fields fall back to defaults).

---

## Combat resolution changes

A new pure helper:

```ts
// game/engine/loadout.ts
export function resolveWeapon(base: Weapon, mods: Partial<Record<ModSlot, WeaponMod>>): Weapon {
  // Sum stat-typed effects; collect flags into a Set.
}
```

Called once at the start of `previewShot` / `resolvePlayerShot`. The rest of combat is unchanged. **Gear** effects are folded into the unit at spawn time (`hp += hpBonus`, `mobility += mobilityBonus`, etc.) so combat code never has to look at the gear slot directly.

`flags` get checked at well-defined points:
- `silenced` → no overwatch trigger from the shot itself (defenders don't hear it).
- `thermal` → optic overrides smoke when calling `hasLineOfSight` from this weapon.
- `piercing` → the resolver subtracts an extra `armor.dr` worth of damage (or sets a flag the resolver respects).

---

## Acquisition (later phase)

Not part of phase-1 ship. When ready:

- **Salvage** — currency dropped by Rust Choir kills (1 from goblin, 3 from orc, 6 from troll). Spend at a between-mission **Workshop** screen to forge mods. Fits the lore: Eagle Corps salvages the cult's scrap and re-forges it.
- **Loot drops** — chance for any kill to drop a mod or piece of gear directly.
- **Soldier ranks** — N kills unlocks a perk (e.g. Ranger rank 2 unlocks the Marksman Scope mod).

For phase-1, **everything is unlocked from start**. Lower content gate, faster iteration.

---

## Phased rollout

### Phase 1 — Foundations (smallest viable shippable cut)
- Add `Gear` type and 4 starter gear items.
- Add `gearId` to `Loadout`; default to `null`; persisted.
- Extend `LoadoutScreen` with a "Gear" section (no tabs yet — just append).
- Apply gear effects at unit spawn (modify hpMax / mobility / etc. in `mkSoldierUnit`).

### Phase 2 — Weapon mods
- Add `WeaponMod` type and ~12 starter mods (3 per slot).
- Add `primaryMods` / `sidearmMods` to `Loadout`; default `{}`.
- New `resolveWeapon(base, mods)` helper. Wire it into `previewShot`, `resolvePlayerShot`, `resolvePlayerSidearm`, `getShotPreview`.
- Reorganize LoadoutScreen into tabs (Weapons / Armor / Gear / Utilities); add per-weapon mod-slot cards with picker modals.
- Modifier-breakdown UI already shows them automatically because they flow through the existing modifier list.

### Phase 3 — Acquisition (Workshop)
- Salvage drops + Workshop screen between missions.
- Mod unlocks gated by salvage cost.
- Deploy screen warns if a soldier has empty mod slots.

---

## Out of scope (for this proposal)

- Multi-slot armor (helmet/chest/legs separately).
- Weapon levelling / per-weapon XP.
- Set bonuses (e.g. "all draconic gear → +1 HP").
- Cosmetic-only options.

These can layer on later without invalidating the core design.

---

## Open questions

1. **Where do mods live in the picker UI** — flat list per slot, or grouped by tag? *Recommendation: flat list, tag shown as a coloured chip next to the name.*
2. **Should mods cost AP to swap mid-mission?** *Recommendation: no — only swappable on the loadout screen.*
3. **Do sidearms get mods?** *Recommendation: yes, but only optic + muzzle (2 slots), not magazine/stock — keeps them simpler than primaries.*
4. **Is `Gear` better named "Kit", "Trinket", "Carry"?** *Recommendation: stick with "Gear" — short, plain, mobile-friendly.*

Approve any of these before phase-1 implementation begins.

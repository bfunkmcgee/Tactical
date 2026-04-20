# Engine Modularity — ContentPack Proposal

Design-only. Path to turning the current game into a reusable turn-based tactical engine where factions, characters, items, maps, and stories can be swapped by replacing one TypeScript module.

---

## Goal

Make a *new tactical scenario* (a different desert war, a sci-fi corridor delve, a Victorian séance heist) shippable by writing **one new content pack** rather than editing the engine. Same engine, different art / data / story.

Not a goal: runtime mod loading, visual editors, in-game user-generated content, scripting languages. Compile-time TS modules only.

---

## Pillars

- **Engine knows nothing about the world.** No string `'rust_goblin'` survives in `src/game/`; no import of "Eagle Corps" anywhere except the active pack.
- **One pack = one folder.** Self-contained: types it imports, ids it owns. No two packs need each other's IDs.
- **Refactor toward, not before.** Phase 1 only moves the existing content into a single pack. We don't add the second pack until we're proving the abstraction.
- **Backwards-compatible.** Existing localStorage saves keep working. Existing tests keep passing.

---

## What's already in good shape (don't touch)

- `src/game/types.ts` — pure type contracts. These become the "engine SDK" packs are built against.
- `src/game/engine/` — pure functions: pathing, LOS, combat math, AI, RNG. Already content-blind.
- `src/state/combatStore.ts` — refers to data through generic ids; takes templates as input.

The engine is already mostly content-blind. The leak points are catalog *imports*, not engine logic.

---

## What's hardcoded today (the leak points)

| Location | Hardcoded thing |
|---|---|
| `state/gameStore.ts` | `roster: ['ranger_kestrel', ...]` — the four soldier ids |
| `game/data/maps/index.ts` | `ALL_MAPS = [RUINED_MARKET, RUST_CHAPEL]` |
| Each map's `classify(ch)` | ASCII-char → enemy id map (`'G' → 'rust_goblin'`) |
| `LoadoutScreen.tsx` | `import { WEAPONS } from '../game/data/weapons'` (direct import) |
| `combatStore.ts` | direct catalog imports for `WEAPONS / ARMOR / UTILITIES / KITS / MODS / SOLDIERS / ENEMIES` |
| `STYLE_EXPLORATION.md`, sprite paths | `Eagle Corps`, `Rust Choir`, sprite filenames hardcoded |

Each of these wants the same fix: route through a `currentPack()` accessor.

---

## ContentPack interface (phase 1)

```ts
// src/content/types.ts
export interface ContentPack {
  id: string;
  name: string;
  description: string;

  // Player content
  soldierTemplates: Record<string, SoldierTemplate>;
  defaultRoster: string[];                 // ids drawn from soldierTemplates

  // Enemy content
  enemyTemplates: Record<string, EnemyTemplate>;

  // Items (the existing five catalogs)
  weapons: Record<string, Weapon>;
  armor: Record<string, Armor>;
  utilities: Record<string, Utility>;
  kits: Record<string, Kit>;
  mods: Record<string, WeaponMod>;

  // Battlefields
  maps: GridMap[];
  /** Per-pack ASCII-char → enemy template id mapping for map authoring. */
  spawnLegend: Record<string, string>;

  // Faction identity for HUD copy & log lines
  playerFaction: { id: string; name: string; sigilColor: string };
  enemyFaction:  { id: string; name: string; sigilColor: string };

  // Optional theming hooks (phase 4)
  theme?: PackTheme;

  // Optional story layer (phase 3)
  campaign?: Campaign;
}

export interface PackTheme {
  /** Override tile palette per kind. Falls back to engine defaults. */
  tileColors?: Partial<Record<TileKind, number>>;
  /** Sprite asset path resolver. Receives a unit's templateId, returns a URL. */
  spritePath?: (templateId: string) => string;
  /** Music / SFX handles (later). */
}
```

Engine and UI code stop importing data files directly:

```ts
// before
import { WEAPONS } from '../game/data/weapons';
const w = WEAPONS[id];

// after
import { useContent } from '../content/registry';
const w = useContent().weapons[id];
```

The registry is trivial:

```ts
// src/content/registry.ts
let active: ContentPack = defaultPack;
export const useContent = () => active;
export const setActivePack = (p: ContentPack) => { active = p; };
```

(For React, a `useContentPack()` hook can wrap zustand if we want hot-swapping at runtime, but compile-time is fine for phase 1.)

---

## File structure changes

```
src/
  game/
    types.ts                  # unchanged — the SDK
    engine/                   # unchanged — pure functions
  content/                    # NEW
    types.ts                  # ContentPack, Campaign, Mission types
    registry.ts               # useContent(), setActivePack()
    packs/
      eagle-corps/            # NEW: home for what we have today
        index.ts              # `export const pack: ContentPack = {...}`
        soldiers.ts
        enemies.ts
        weapons.ts
        armor.ts
        utilities.ts
        kits.ts
        mods.ts
        maps/
          ruined_market.ts
          rust_chapel.ts
        lore.ts               # faction names, descriptions
  state/
    gameStore.ts              # roster from useContent().defaultRoster
    combatStore.ts            # all catalog refs go through useContent()
  ui/
    LoadoutScreen.tsx         # catalogs from useContent()
    CombatHUD.tsx             # same
```

`src/game/data/` deletes after the move (kept as a redirect during transition if needed).

---

## Map authoring stays simple

Today each map's `classify` function hardcodes `'G' → 'rust_goblin'`. After the move, a map only emits *spawn keys*, not enemy ids:

```ts
// inside the map module
{ kind: 'floor', spawn: 'G' }      // unchanged shape
```

The pack's `spawnLegend` resolves `'G'` to the right enemy template at deploy time:

```ts
// in combatStore.init()
const legend = useContent().spawnLegend;
for (const es of map.enemySpawns) {
  const enemyId = legend[es.spawnKey] ?? es.fallbackId;
  const e = mkEnemyUnit(enemyId);
  ...
}
```

Means a different pack can use the same maps with different enemies just by re-binding the legend.

---

## Campaign layer (phase 3)

Today the loop is *menu → loadout → combat → debrief → menu*. A Campaign adds:

```ts
export interface Campaign {
  id: string;
  name: string;
  briefing: string;
  missions: Mission[];                      // ordered or graph-shaped
  initialState: CampaignState;              // squad, salvage, unlocks
}

export interface Mission {
  id: string;
  name: string;
  briefing: string;
  mapId: string;                            // references pack.maps
  objective?: MissionObjective;             // default = eliminate_all
  spawnsOverride?: SpawnSpec[];             // override pack spawnLegend per mission
  unlockCondition?: (s: CampaignState) => boolean;
  onVictory?: (s: CampaignState) => CampaignState;
}

export type MissionObjective =
  | { kind: 'eliminate_all' }                                  // current behaviour
  | { kind: 'eliminate_target'; templateId: string }
  | { kind: 'reach_tile'; pos: Vec2; turns?: number }
  | { kind: 'survive_turns'; turns: number }
  | { kind: 'protect_unit'; templateId: string };

export interface CampaignState {
  squadIds: string[];
  fallenIds: string[];
  salvage: number;
  unlockedItems: string[];
  completedMissionIds: string[];
}
```

Combat store learns about objectives via a thin wrapper that asks the active mission "is this state a win/loss?" instead of always checking "any enemies left?".

This stays out of phase 1.

---

## Phased rollout

### Phase 1 — Extract (the only change worth committing right now)
- Create `src/content/types.ts` with `ContentPack` (no `Campaign` field yet).
- Create `src/content/registry.ts`.
- Move `src/game/data/*` → `src/content/packs/eagle-corps/*`. The pack `index.ts` re-exports the whole catalog as one `ContentPack`.
- Replace every direct catalog import (engine + UI) with `useContent()`.
- `gameStore.roster` initialised from `useContent().defaultRoster`.
- Maps' `classify` returns `spawn: 'G' | 'O' | 'T' | 'P'` keys; pack's `spawnLegend` resolves them.
- Tests still pass; `npm run dev` plays identically.

**No new content. No new player-visible behaviour. Just a refactor.**

### Phase 2 — Validate with a second pack
Build a tiny second pack — call it `void-watch` (sci-fi corridor scenario): 2 soldier classes, 1 enemy type, 1 map, 4 weapons. *Author it without touching engine code.* Whatever pain shows up here is the abstraction gap to fix.

### Phase 3 — Campaign + objectives
Add `Campaign` and `Mission` types. Add a `campaignStore` that tracks `CampaignState`. Combat store consults `mission.objective` instead of hardcoding "eliminate all". Add a `MissionSelectScreen` between menu and loadout.

### Phase 4 — Theming hooks (optional)
`PackTheme.tileColors` so different packs look visually distinct without rewriting `PixiStage`. `PackTheme.spritePath` so packs can ship their own sprite folders.

---

## Out of scope (stay disciplined)

- Runtime pack loading (no JSON-from-URL loader; no plugin manifests).
- Cross-pack content mixing (one pack active at a time).
- Visual map editor.
- Procedural mission generation.
- Asset bundlers / sprite atlases (load `.svg` per file is fine).
- Custom scripting language for mission events.

If any of these become necessary later, the `ContentPack` interface is small enough to extend without breaking existing packs.

---

## Migration cost (rough)

| Phase | Files moved | Files modified | Risk |
|---|---|---|---|
| 1 — Extract | ~10 (data files into pack folder) | ~6 (gameStore, combatStore, LoadoutScreen, CombatHUD, PixiStage, tests) | Low — purely mechanical refactor; tests gate it |
| 2 — Second pack | 0 | 0 in engine | Medium — abstraction gaps surface here |
| 3 — Campaign | 0 | ~3 (combatStore, gameStore, new MissionSelectScreen) | Medium — new state shape |
| 4 — Theming | 0 | ~2 (PixiStage) | Low |

Phase 1 should take a single focused session. Tests are the safety net — if the post-refactor 22-test suite is green, the refactor was correct.

---

## Open questions

1. **Pack ergonomics** — should `ContentPack` expose `Record<string, T>` maps, `T[]` arrays, or accessors `getWeapon(id)` / `allWeapons()`? *Recommendation: maps, with thin helpers in registry — matches today's shape.*
2. **Map ownership** — do `GridMap`s belong to the pack, or are they engine-level with packs binding spawn legends? *Recommendation: pack-owned. Engine just renders the grid.*
3. **Mission objectives in phase 1** — leave as "eliminate all" or build the type now and only use one variant? *Recommendation: build the union type; only implement `eliminate_all` for now. Cheap to add.*
4. **Hot-swap packs at runtime?** — useful for dev/test, costs a registry refresh on every pack change. *Recommendation: support it via `setActivePack` + emit a store reset; mostly for dev menus, not production.*

Approve any of these and I'll start phase 1.

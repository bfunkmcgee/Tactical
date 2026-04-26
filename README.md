# Tactical: Runes & Rifles

Mobile-friendly, browser-based turn-based tactics. Fantasy re-skins of
modern tactical gear: runic carbines, mithril-laced plate carriers,
alchemical grenades. Single-pack-or-multi-pack content architecture,
deterministic combat resolver, isometric painted+procedural map render.

## Stack

- Vite + React 18 + TypeScript
- PixiJS v8 (isometric WebGL renderer)
- Zustand (state)
- Howler (audio)
- vite-plugin-pwa (installable on mobile)
- Vitest (engine + helper unit tests; 250 tests as of last commit)

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (Vitest)
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + production build
```

## Play

1. **New Run** from the menu, then pick a content pack:
   - **Eagle Corps vs. The Rust Choir** — desert + refinery missions,
     Ranger / Warden / Mystic / Sapper soldiers, goblinoid scrap
     raiders.
   - **Void-Watch · Hollows of the Bulwark** — same engine, different
     palette + roster + enemies.
2. **Field Camp / Map Room** — between missions, refit, manage your
   roster, and pick the next mission from the active zone. Excursions
   are multi-mission deployments; downed soldiers sit out the rest of
   the excursion.
3. **Loadout** — primary, sidearm, armor (per-slot: helmet / shoulders
   / chest / legs / gauntlets), kit, up to 3 utilities. Loadouts
   persist to `localStorage`.
4. **Deploy**. On your turn:
   - **Tap a soldier portrait** in the left-edge rail (or on the map)
     to select.
   - **Tap a reachable tile** to move. Gold = 1 AP, copper = 2 AP.
     Red wash on a reachable tile = exposed to enemy LOS; stronger
     red + outline = an enemy on overwatch can shoot you there.
   - **Fire** / **Sidearm** — confirm the shot via the modifier card
     that pops up (hit %, crit %, dmg, modifier breakdown).
   - **Utility** — orbs, draughts, smoke. Tap a target tile to throw.
   - **Class ability** — Ranger _Mark_, Warden _Bracing Fire_, Mystic
     _Arcane Sight_, Sapper _Demolish_. One per soldier per turn.
   - **Refit** — swap weapon mods mid-mission for 1 AP per swap.
   - **Overwatch** — trade remaining AP for reactive fire next turn.
   - **End Turn** hands off to the AI.
5. **Camera**: drag to pan, pinch / wheel to zoom (defaults to 1.5×).
6. **Win conditions** vary per mission — eliminate all, eliminate a
   specific target, reach a tile, destroy an objective, hold a point
   for N rounds, extract a VIP. The HUD's top-left chip shows the live
   objective + progress.

## Layout

```
src/
  App.tsx                              # screen router
  game/
    types.ts                           # shared engine types
    audio/                             # howler-backed sound engine
    engine/                            # pure deterministic logic
      grid.ts, pathing.ts              # A* + reachable flood
      los.ts                           # Bresenham + cover resolution
      combat.ts, shotPipeline.ts       # hit %, damage, crit, armor DR
      ai.ts                            # enemy decision tree + archetypes
      enemyTurn/                       # planner + runner + step types
      overwatch.ts                     # reaction fire (both factions)
      objectives.ts                    # 6 objective kinds + evaluation
      mission.ts, turn.ts              # mission lifecycle + turn flow
      abilities.ts                     # class-ability resolvers
      loadout.ts, stats.ts             # loadout migrations + derived stats
      events.ts, log.ts                # combat-event stream + log lines
      rng.ts                           # mulberry32 seeded RNG
      rig.ts                           # human rig joint definitions
    maps/                              # GridMap definitions per mission
    rendering/
      isoProjection.ts                 # grid <-> screen
      PixiStage.tsx                    # Pixi v8 mount + camera + ticker
      atmosphere.ts                    # vignette + biome tint + dust
      overlays.ts                      # reach + threat + LOS overlays
      fx.ts                            # blood + floaters + particles
      context.ts                       # spriteCache + diamond primitive
      input/                           # pan / pinch / tap controller
      map/                             # tile/cover/decal/edge passes
      biomes/                          # desert / refinery / urban
      units/                           # rig composition + animation
  content/
    types.ts                           # ContentPack shape
    registry.ts                        # active-pack accessor + lookups
    rigs/                              # human rig + weapon-anchor table
    packs/
      eagle-corps/                     # Rust Choir campaign
        weapons.ts, mods.ts, armor.ts, utilities.ts, kits.ts,
        soldiers.ts, enemies.ts, abilities.ts, zones.ts, index.ts
      void-watch/                      # Hollow Wraith campaign
  state/
    gameStore.ts                       # screens, roster, loadouts (persisted)
    combatStore.ts                     # mission state, turn phase, log
    campaignStore.ts                   # excursions, wounds, stockpile
  ui/
    MainMenu, MapRoomScreen, FieldCampScreen, ExcursionScreen,
    ExcursionCompleteScreen, BarracksScreen, CharacterCreationScreen,
    LoadoutScreen, CombatScreen, CombatHUD, DebriefScreen
    combat/                            # extracted HUD components:
      ControlDeck, CombatTopBar, RosterRail, MissionLog,
      SelectedUnitHeader, ActionBar, PendingShotCard,
      PendingUtilityCard, RefitOverlay, groupActions
    components/                        # ModPicker + shared widgets
    RigPreview, SoldierPortrait        # shared portrait/preview
  styles/                              # tokens.css, global.css
public/
  styles/flat/                         # SVG asset tree
    human/, soldiers/, enemies/        # rig parts + per-template overrides
    armor/, armor_legs/, weapons/      # equipment art
    biomes/desert/                     # painted floor PNGs (in progress)
```

## Architecture notes

**Content packs.** Everything theme-able — soldiers, enemies, weapons,
armor, mods, utilities, kits, abilities, zones — lives in a
`ContentPack` object under `src/content/packs/`. Two ship today
(`eagle-corps`, `void-watch`); they share the engine + UI but swap
identity, palette, item catalog, and enemy roster. Pack swap is
hot-reload-clean.

**Element tags.** Every weapon / armor / utility carries an
`ElementTag` — `runic` / `draconic` / `alchemical` / `fae` /
`mundane`. Drives FX tinting + lets future damage modifiers key off
type matchups without touching combat math.

**Rig-composed characters.** Soldiers + most enemies render via a
named-joint rig (head / torso / arms-back / arms-front / legs) with
per-soldier `appearance.partOverrides`, hair styles, base outfits,
armor overlays, kit overlays, and clothing. See `humanRigBody.ts`
and `UnitNode.ts`. Per-class weapon hold profiles
(`fireStyles.ts:WEAPON_HOLD`) place the gun + arms differently for
rifle vs pistol vs heavy.

**Painted vs procedural map.** Cover + walls + props + decals render
procedurally via Pixi Graphics. Floor tiles render painted PNG iso
sprites when the active biome ships them (currently `desert` only;
fallback path stays procedural per-tile if the texture preload
misses or the biome opts out).

**Deterministic resolver.** Combat resolution runs on a seeded
`mulberry32` RNG; replays from the same mission seed produce
identical outcomes. AI decisions are pure functions of state.

**Enemy archetypes.** Each `EnemyTemplate` can carry an optional
`archetype` (`flanker` / `anchor` / `grenadier` / `sniper` /
`berserker`) that biases the existing decision tree without
rewriting it. See `ai.ts` + `ai.test.ts`.

## Out of scope (today)

- Multiplayer + account sync.
- Animated painted assets (sprite-sheet animation system isn't
  wired; current animation is per-rig-part programmatic).
- Painted walls + cover silhouettes (procedural for now; painted
  floors in flight).
- Pack hot-swap mid-run (requires a state reset).

## Adjacent docs

- `ENGINE_MODULARITY.md` — engine ↔ renderer ↔ store boundaries.
- `EXCURSION_LOOP.md` — campaign / excursion / mission flow.
- `LOADOUT_DESIGN.md` — armor-piece decomposition + refit rules.
- `STYLE_EXPLORATION.md` — the painted-look mood pass + asset briefs.

# Tactical: Runes & Rifles

Mobile-friendly, browser-based turn-based tactics MVP. Fantasy re-skins of modern tactical gear: runic carbines, mithril-laced plate carriers, alchemical grenades.

## Stack

- Vite + React 18 + TypeScript
- PixiJS v8 (isometric WebGL renderer)
- Zustand (game state)
- vite-plugin-pwa (installable on mobile)
- Vitest (engine unit tests)

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # engine unit tests
npm run build    # typecheck + production build
```

## Play

1. **New Run** from the menu.
2. **Loadout**: pick each soldier's primary, sidearm, armor, and up to 2 utilities. Loadouts persist to `localStorage`.
3. **Deploy** to the Ruined Market. Your squad of four faces Wraith Raiders and a Gutter Troll.
4. On your turn:
   - **Tap a soldier** in the top bar (or on the map) to select.
   - **Tap a reachable tile** to move (blue = 1 AP, yellow = 2 AP).
   - **Fire** → tap a red-highlighted enemy to shoot.
   - Utility buttons throw grenades / apply medkits at a tapped tile.
   - **Overwatch** trades remaining AP for reactive fire next turn.
   - **End Turn** hands off to the AI.
5. **Camera**: drag to pan, pinch or wheel to zoom.
6. Eliminate every hostile to win. Lose every soldier to fail.

## Layout

```
src/
  game/
    types.ts                    # shared types
    data/                       # weapons, armor, utilities, soldiers, enemies, maps
    engine/
      grid.ts, pathing.ts       # A* + reachable flood
      los.ts                    # Bresenham + cover resolution
      combat.ts                 # hit %, damage, crit, armor DR
      ai.ts                     # enemy utility AI
      rng.ts                    # mulberry32 seeded RNG
    rendering/
      isoProjection.ts
      PixiStage.tsx             # Pixi v8 mount + camera + input
  state/
    gameStore.ts                # screen, roster, loadouts (persisted)
    combatStore.ts              # units, turn phase, log, actions
  ui/                           # MainMenu, LoadoutScreen, CombatScreen, CombatHUD, DebriefScreen
  styles/                       # tokens.css, global.css
```

## Design notes

Everything theme-able is data: add an entry to `weapons.ts`, `armor.ts`, `utilities.ts`, `soldiers.ts`, `enemies.ts`, or `maps/`. Every item carries an `ElementTag` (`runic` / `draconic` / `alchemical` / `fae` / `mundane`) so FX can be tinted consistently as art lands.

The combat resolver is deterministic under a seeded RNG (`mulberry32`) so replays are reproducible.

## Out of scope (MVP)

Progression/XP, multiple maps, multiplayer, audio, account sync. The engine is structured so each can be added without rewriting combat core.

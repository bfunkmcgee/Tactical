# Excursion Loop — Base Hub ↔ Zone Deployment

Design-only. Proposal for the primary gameplay loop: home base between deployments, each deployment is a **zone** containing multiple **missions** plus randomized **skirmishes**, with resources locked to what you carry in and armor visibly degrading until extraction.

---

## Loop overview

```
   ┌─────────────────────────────────────────────────────────────┐
   │                      Base Camp Hub                           │
   │ Armoury · Roster · Stockpile · Map Room · (Intel Board)      │
   └──────────────────────────┬──────────────────────────────────┘
                              │ deploy to zone
                              ▼
   ┌─────────────────────────────────────────────────────────────┐
   │                   Excursion Overview                         │
   │ Mission tree · Skirmish alerts · Squad status · Consumables  │
   └───────┬──────────────────────────────────────┬──────────────┘
           │ begin mission                        │ request extract
           ▼                                      │   (when all
   ┌──────────────────────────┐                  │    objectives met)
   │ Mission Brief → Combat   │                  │
   │        → Debrief         │◄── random ───────┘
   │                          │    skirmish
   └──────────────┬───────────┘    (between missions)
                  │ back to overview
                  └──────────────────▲
                                     │
                                     │ extraction
                                     ▼
                          ┌──────────────────────┐
                          │ Extraction Debrief   │
                          │ (armor cleaned/fixed)│
                          └──────────┬───────────┘
                                     │
                                     ▼
                              [Base Camp Hub]
```

Key property: **base resources are unavailable mid-excursion.** Between missions in the same deployment, you cannot pull from the stockpile at base. You can only use what you carried in, plus **resupply consumables** (call-ins).

---

## Pillars

- **Commit creates tension.** Going into a zone is a commitment — you can't rearm from base between its missions. Poor planning compounds.
- **Pacing is layered.** Mission-scale decisions (which tile, which shot), excursion-scale decisions (do I push the next mission or extract now?), base-scale decisions (which zone is worth the risk this week?). Each layer should reward different kinds of play.
- **Visible wear is the HUD.** Dirt and damage on soldier sprites are not cosmetics — they're the player's *felt* gauge of how rough the excursion has been. Reset on extraction is a relief payoff.
- **Randomized skirmishes, curated objectives.** Zone *missions* are authored (scripted objectives, fixed maps). Zone *skirmishes* roll from a weighted pool (random maps + enemy mixes) to fill the time between missions.

---

## Three-layer state hierarchy

Current engine keeps only one state scope — `combatStore`, reset on each deploy. The new loop needs three:

| Layer | Persists across | Examples |
|---|---|---|
| **Campaign** | Everything | Squad roster, soldier ranks, base stockpile, completed zones, currency, story flags |
| **Excursion** | Missions inside one zone (dies on extract) | Current zone, completed mission ids, squad HP/ammo carry, armor dirt/damage, consumables remaining, skirmish queue |
| **Mission** | A single combat (unchanged: `combatStore`) | Units, smoke tiles, pending shots, turn phase |

### State flow

1. **Base → Zone**: Player picks a zone. Campaign state forks into an excursion. Squad spawned at mission 1 with full HP/ammo. Consumables copied into excursion stockpile.
2. **Mission ends** (victory): Excursion absorbs the mission's end state — each soldier's `hp`, `ap` reset but ammo persists, wounds persist, armor dirt/damage incremented. Kills and loot added to excursion tally.
3. **Skirmish trigger** (optional, between missions): Roll vs `zone.skirmishChance`; pick weighted skirmish from pool; run as a mission but mark it as skirmish for the debrief.
4. **Extraction**: When all zone `missions[].completed`, "Request Extraction" enables. Extraction completes → excursion merges back into campaign (loot added, wounds recorded, armor wear cleared, consumables reset to base-stockpile default).
5. **Extraction failure** (wipe): campaign records soldiers as *lost* or *wounded* (see open q), zone locks out or can be re-attempted — TBD.

---

## Data model

### Zones

```ts
export interface Zone {
  id: string;
  name: string;
  description: string;
  biome: 'desert' | 'derelict' | 'ruin' | string;  // informs map-pool filtering

  /** Ordered or graph-shaped missions that count toward the zone objective. */
  missions: Mission[];

  /** Random-encounter pool rolled between missions. */
  skirmishes: Skirmish[];
  skirmishChance: number;   // 0..1 per inter-mission gap

  /** Optional cap on how many resupply consumables the player can bring. */
  consumableLimit?: number;
}
```

### Missions and objectives

```ts
export interface Mission {
  id: string;
  name: string;
  briefing: string;
  mapId: string;
  objective: MissionObjective;
  spawnsOverride?: Record<string, string>;   // per-mission spawnLegend tweak
  unlockCondition?: (e: ExcursionState) => boolean;
  onVictory?: (e: ExcursionState) => Partial<ExcursionState>;
}

export type MissionObjective =
  | { kind: 'eliminate_all' }
  | { kind: 'eliminate_target'; templateId: string }
  | { kind: 'reach_tile'; pos: Vec2; turnLimit?: number }
  | { kind: 'destroy_objective'; pos: Vec2; hp: number }
  | { kind: 'defend_point'; pos: Vec2; turns: number }
  | { kind: 'extract_vip'; vipSpawn: Vec2; extractTile: Vec2 };
```

Phase-1 implementation: build the union; implement only `eliminate_all`. Other kinds show up as "(not yet playable)" in the mission list until their handlers exist.

### Skirmishes

```ts
export interface Skirmish {
  id: string;
  name: string;
  flavor: string;               // one-line "Rust raiders detected in the substation."
  mapId: string;
  objective: MissionObjective;  // usually eliminate_all
  weight: number;               // relative pick probability in the pool
  spawnsOverride?: Record<string, string>;
}
```

### Excursion state

```ts
export interface ExcursionState {
  zoneId: string;
  startedAtRealTime: number;

  /** Completed mission/skirmish ids and their outcome. */
  history: Array<{ id: string; kind: 'mission' | 'skirmish'; outcome: 'victory' | 'defeat' }>;

  /** Squad state carries across missions inside this excursion. */
  squad: Array<{
    soldierId: string;
    hp: number;             // current HP (carries between missions)
    ammoPrimary: number;    // unspent rounds carry
    ammoSidearm: number;
    utilityCharges: number[];
    status: { overwatch: false; blinded: false; suppressed: false };
    /** Visible wear — see "Armor condition" below. */
    dirt: number;           // 0..100
    damage: number;         // 0..100
  }>;

  /** Resupply consumables brought from base stockpile. */
  consumables: Record<string, number>;  // consumableId → remaining count

  /** Pending skirmish rolled but not yet started (nullable). */
  pendingSkirmish?: Skirmish;

  /** Extraction ready = all missions completed. */
  extractionReady: boolean;
}
```

### Campaign state (thin for phase 1)

```ts
export interface CampaignState {
  squadIds: string[];               // all owned soldiers (≥ roster size)
  woundedIds: Record<string, number>;  // soldierId → missions remaining until healed
  stockpile: Record<string, number>;   // consumableId → owned count
  unlockedZones: string[];
  completedZones: string[];
  currency: number;                  // salvage for phase-3 workshop
}
```

---

## Resupply consumables (the tension valve)

Because base resources are locked, these single-use items are the only way to recover during an excursion. Carried from base; used from the **Excursion Overview** screen *between* missions (not during combat).

Starter catalog:

| Id | Name | Effect when used |
|---|---|---|
| `ammo_crate` | Ammo Crate | Restores every soldier's primary + sidearm magazines to full |
| `med_cache` | Med Cache | +4 HP to every living soldier (no overheal) |
| `armor_patch` | Armor Patch | Reduces every soldier's `damage` accumulator by 50; no effect on dirt |
| `field_wash` | Field Wash | Cuts `dirt` by 100% on every soldier; no effect on damage (narrative: "clean kit, clearer sightlines"; mild aim bonus next mission, say +5) |
| `reinforcement` | Reinforcement Drop | Adds one soldier from the base roster (not in squad) to the squad at full HP — available only if `squad.length < 4` |

Consumables live in the pack's catalog (new `consumables` field on `ContentPack`). The zone caps how many the player can bring via `zone.consumableLimit`.

Design intent: drops should feel scarce. 1–2 per excursion. Picking "which resource to protect" (ammo? HP? armor?) is the core inter-mission decision.

---

## Armor condition (dirt + damage)

Two per-soldier accumulators tracked in `ExcursionState.squad[].dirt` and `.damage`.

### Accumulation rules

```
after each mission:
  dirt += 15                        // base wear-and-tear
  dirt += combatEncounters × 5      // bonus if soldier engaged

on each incoming hit on the soldier:
  damage += 5 + round(10 × dmgTaken / soldier.hpMax)
```

Both clamp to 100. Reset to 0 at extraction.

### Render plan

The engine currently uses colored rectangles for units in `PixiStage`. Phase-5 wiring for real sprites lands on top of this:

- **Dirt overlay**: sepia tint multiplied over the sprite, alpha = `dirt / 100 × 0.6`. Implemented as a per-sprite `ColorMatrixFilter` with growing desaturation + warm shift.
- **Damage overlay**: a "cracks" layer composited additively, alpha = `damage / 100`. For placeholder rectangles: red tint pulse at the edges that intensifies with damage.
- **Extraction cutscene**: a short flash-to-white fade on the debrief transition, after which sprites render at 0/0.

All logic lives in the renderer; combat math is unaffected (open question: does damage add a small aim penalty? See open qs.)

---

## ContentPack extension

Adds fields to the existing `ContentPack`:

```ts
export interface ContentPack {
  // ...existing fields...

  /** Zones available in this campaign. Empty = old-style one-off mission mode. */
  zones: Zone[];

  /** Resupply consumables catalog for this campaign. */
  consumables: Record<string, Consumable>;

  /** Initial base-stockpile counts for a new campaign. */
  initialStockpile: Record<string, number>;
}

export interface Consumable {
  id: string;
  name: string;
  flavor: string;
  kind: 'ammo_crate' | 'med_cache' | 'armor_patch' | 'field_wash' | 'reinforcement';
  tag: ElementTag;
}
```

Existing pack (Eagle Corps) gets a small zone tree: one zone `salvage-run`, three missions (already-built maps + two new ones later), one skirmish pool entry.

Void-Watch keeps minimal zone: one zone, two missions, zero skirmishes.

Packs without zones fall back to the current "pick a random map and fight" mode, so the refactor is non-breaking.

---

## UI flow

### Base Camp Hub (replaces current MainMenu)

```
┌────────────────────────────────────────────┐
│  TACTICAL  ·  Eagle Corps                   │
│                                             │
│  ┌──────────┐  ┌──────────┐                 │
│  │ ARMOURY  │  │  ROSTER  │                 │
│  └──────────┘  └──────────┘                 │
│  ┌──────────┐  ┌──────────┐                 │
│  │ STOCKPILE│  │ MAP ROOM │                 │
│  └──────────┘  └──────────┘                 │
│                                             │
│  Campaign: ▓▓▓▓░░░░░░  2/5 zones cleared    │
└────────────────────────────────────────────┘
```

- **Armoury** → existing LoadoutScreen (unchanged).
- **Roster** → list of all soldiers, wound status, XP bar (phase 3+).
- **Stockpile** → choose how many of each consumable to carry into the next excursion.
- **Map Room** → zone picker. Shows mission count, biome, recommended squad size.

### Excursion Overview (new — shown between missions)

```
┌────────────────────────────────────────────┐
│  ZONE · Ruined Market Salvage   [EXTRACT]  │
├────────────────────────────────────────────┤
│  SQUAD                                      │
│  Kestrel   HP 9/10  AMMO 3/5  ▓░░ wear      │
│  Brannock  HP 12/14 AMMO 2/3  ▓▓░ wear      │
│  Seraphine HP 9/9   AMMO 2/2  ░░░ wear      │
│  Orin      HP 7/11  AMMO 3/3  ▓▓▓ wear      │
├────────────────────────────────────────────┤
│  MISSIONS                                   │
│  ✓ Clear the Market     (complete)          │
│  ● Secure the Altar     (next)              │
│  ○ Purge the Chantry    (locked)            │
├────────────────────────────────────────────┤
│  CONSUMABLES                                │
│  Ammo Crate ×1   Med Cache ×2   Field Wash ×1 │
│  [USE] [USE] [USE]                          │
├────────────────────────────────────────────┤
│  [BEGIN NEXT MISSION]    (or Extract ↑)     │
└────────────────────────────────────────────┘
```

Between two missions: a skirmish-trigger roll can push a modal above this, e.g. *"Rust raiders detected in the substation — engage?"* with Engage / Avoid buttons. Avoiding may cost a resource (flavour: fuel, rations, time) in a later phase.

---

## Phased rollout

### Phase 1 — State skeleton (smallest shippable)
- Add `campaignStore` + `excursionStore` (zustand).
- Extend `ContentPack` with `zones`, `consumables`, `initialStockpile`.
- Add `Zone` / `Mission` / `MissionObjective` / `Skirmish` / `Consumable` types.
- Author **one zone** for Eagle Corps (`salvage-run`): 3 missions, all `eliminate_all`, one skirmish.
- Author **one zone** for Void-Watch (`derelict-sweep`): 2 missions.
- Replace `combatStore.init()` map-picker with "take map from the next scheduled mission."
- Replace MainMenu with Base Camp Hub shell (minimum: 2 rooms — Armoury + Map Room).
- Replace win screen with Excursion Overview; extract returns to Base.
- **Squad HP/ammo/charges carry between missions in an excursion.**

### Phase 2 — Mission objective variety
- Implement `reach_tile`, `eliminate_target`, `destroy_objective`.
- Combat HUD shows objective info (target marker, turn counter, HP of destroyable).
- Content: two new missions per zone using the new kinds.

### Phase 3 — Resupply consumables
- Add `consumables` to campaign inventory + stockpile screen.
- Implement the 5 consumable kinds.
- Inter-mission consumable UI on Excursion Overview.
- Zone consumable cap enforcement.

### Phase 4 — Skirmishes
- Inter-mission skirmish trigger + modal choice.
- Skirmish pool authoring (shorter maps, smaller enemy counts).
- Post-skirmish returns to Excursion Overview, not to the next authored mission.

### Phase 5 — Armor condition visualization
- Dirt + damage accumulators on excursion squad.
- Pixi rendering: sepia tint + damage overlay on unit sprites.
- Flash-to-white on extraction.
- Clean reset on extraction.

### Phase 6 — Roster, wounds, extraction failure
- Wounded soldiers sit out N missions (N tied to HP at extraction or damage taken).
- Wipe handling: soldiers lost / recovered later / zone lockout.
- Base → Roster screen.

### Phase 7 — Polish
- Defend objective + Extract VIP objective kinds.
- Zone narrative beats (briefings).
- Intel Board in base.
- Zone-specific map pools (biome filter).

---

## Out of scope

- Procedural zone generation.
- Persistent world map / time pressure ("N days left this season").
- Permadeath for phase 1.
- Tech tree / base upgrades.
- Morale / psychology system.
- Multi-squad or off-map operations.
- Audio cues per zone.

Each can layer on later without invalidating this skeleton.

---

## Decisions (locked)

1. **Squad size** — Deploy up to **7 soldiers** per excursion, selected from the base roster. Today's 16×12 maps only expose 4 player spawns so the practical cap in phase 1 is still 4; growing maps to 7 spawn points is a phase-2 content task.
2. **Wound recovery** — **Proportional.** HP ≤ 30% at extraction = 3 missions on the bench, HP ≤ 60% = 1 mission, otherwise 0.
3. **Extraction failure** — Phase 1: squad-wide wipe leaves every survivor heavily wounded (long bench time); no permadeath. Permadeath toggle later.
4. **Resupply acquisition** — Granted per excursion, zone-determined. Small zones grant 1 of each consumable, larger zones grant 2. No shop economy in phase 1.
5. **Armor damage affects stats** — Mechanical, not cosmetic-only. When a soldier's `damage` ≥ 80 during an excursion they take **−5 aim** and **−1 max HP** until extraction. Armor-patch consumable is the intended mitigation.
6. **Skirmish avoid cost** — Yes. Avoiding a rolled skirmish spends a consumable (exact tradeoff TBD in phase 4 — probably a single "any" consumable of the player's choice, narratively rations/fuel).

These answers shape later phases; phase 1 (state skeleton + one zone per pack) is being implemented now.

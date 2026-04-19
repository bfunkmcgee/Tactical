# Sprite Style Exploration

You picked **Option B — Flat vector**. The full player squad now reads as a single **desert scout unit**: sand palette, weathered leather, matching scout cloaks across all four classes, and a shared runic-blue unit sigil on every pauldron patch. Each class keeps its own silhouette and tag-color accent (runic / draconic / fae / alchemical) through specialist gear.

---

## Desert Scout Unit (4 classes)

### Ranger · Kestrel — Runeweave Carbine (runic blue)

<p>
  <img src="public/styles/flat/soldier.svg" width="240" alt="Ranger Kestrel"/>
</p>

Scout: sand uniform with full flowing hooded cloak, shemagh scarf, leather kneepads, carbine with scope and runic-blue muzzle core.

### Warden · Brannock — Dragonmaw Autocannon (draconic orange)

<p>
  <img src="public/styles/flat/soldier_warden.svg" width="240" alt="Warden Brannock"/>
</p>

Bulwark: sand-plated heavy armor weathered by sun and dust, short shoulder mantle cape (practical for heavy kit), hanging tabard bearing the squad sigil, spiked pauldrons, full crested helm. Draconic-orange kept only to ember accents (chest insignia, rivets, knee gems, muzzle core) and the helm's visor points.

### Mystic · Seraphine — Arclight Marksman (fae violet + runic blue)

<p>
  <img src="public/styles/flat/soldier_mystic.svg" width="240" alt="Mystic Seraphine"/>
</p>

Marksman: sand-colored long scout robe replacing the violet coat, fae violet surviving only in the trim, rune-gem buttons, circlet, and ocular monocle. Full scout cloak around the shoulders (clasp in violet), silver swiftstep greaves, silver braid, pointed ear. Rifle keeps its runic-blue muzzle and rune coils.

### Sapper · Orin — Hexbore Scattergun (alchemical green)

<p>
  <img src="public/styles/flat/soldier_sapper.svg" width="240" alt="Sapper Orin"/>
</p>

Demolitions: sand canvas vest over sand cargo pants, short desert poncho with fringed hem (distinct from the Ranger's long cloak), Oakheart Helm wrapped in sand cloth, goggles pushed up to the brow, gas-mask hose around the neck. Alchemical green kept only on vial bandolier, goggle lenses, scattergun side-vial, and muzzle glow. Four Embercore Orbs (draconic orange) still glow on the belt as utility grenades.

---

## Unit identity

Every soldier now shares:
- **Base palette:** sand `#c6a473` → `#5a3f22` with weathered leather `#3a2414`
- **Scout cloak:** sand/umber gradient `#a98560` → `#4a3420` (Ranger full hooded, Mystic full hooded, Warden shoulder mantle, Sapper short utility poncho)
- **Squad sigil:** small runic-blue diamond patch on the left shoulder across all classes
- **Desert scarf / cloth wrap** at the neck or helmet

Class tag color lives only in **specialist gear** so it never overpowers the unit read:

| Class  | Tag            | Visible only on                                |
|--------|----------------|------------------------------------------------|
| Ranger | Runic blue     | helmet emblem, chest sigils, carbine muzzle     |
| Warden | Draconic orange| visor dots, chest insignia, rivets, muzzle      |
| Mystic | Fae violet     | cloak clasp, coat trim, monocle, circlet gems   |
| Sapper | Alchemical green | chest sigil, bandolier vials, goggle lenses, scattergun muzzle |

(Note: The **weapon's own tag** can be independent — Seraphine's Arclight Marksman is runic, so its rune coils and muzzle core are blue even though she's a fae class.)

---

## Enemies

### Wraith Raider
<p><img src="public/styles/flat/enemy.svg" width="240" alt="Wraith Raider"/></p>

### Gutter Troll
<p><img src="public/styles/flat/enemy_troll.svg" width="240" alt="Gutter Troll"/></p>

## Tiles
<p><img src="public/styles/flat/tiles.svg" width="480" alt="Flat vector tiles"/></p>

---

## Next steps once you confirm the squad

1. Swap the placeholder rectangles in `PixiStage.tsx` for these SVGs (load via `Assets.load()`, depth-sort on `g.x + g.y`).
2. Add idle bob + aim-at-target variants per character.
3. Second tile biome (sand-ruin oasis / desert shrine) reusing the same tile family so the map matches the unit.
4. Additional enemy archetypes to fit a desert setting (e.g. *Sand Wraith*, *Glass Scarab*).

---

<details>
<summary>Original four-way A/B/C/D comparison</summary>

### A · Pixel 16-bit
<p><img src="public/styles/pixel/soldier.svg" width="140"/> <img src="public/styles/pixel/enemy.svg" width="140"/> <img src="public/styles/pixel/tiles.svg" width="360"/></p>

### C · Painterly
<p><img src="public/styles/painterly/soldier.svg" width="140"/> <img src="public/styles/painterly/enemy.svg" width="140"/> <img src="public/styles/painterly/tiles.svg" width="360"/></p>

### D · Noir blueprint
<p><img src="public/styles/blueprint/soldier.svg" width="140"/> <img src="public/styles/blueprint/enemy.svg" width="140"/> <img src="public/styles/blueprint/tiles.svg" width="360"/></p>

</details>

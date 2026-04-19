# Sprite Style Exploration

You picked **Option B — Flat vector**. Below is the full player squad roster plus two enemies, all in the refined flat-vector style. Each class reads differently at a glance: cloth silhouettes, color palettes, and weapon profiles are class-specific.

---

## Player Squad (4 classes)

### Ranger · Kestrel — sand scout, Runeweave Carbine (runic blue)

<p>
  <img src="public/styles/flat/soldier.svg" width="240" alt="Ranger Kestrel"/>
</p>

Desert palette and a hooded cloak draped over both shoulders — mobility-first scout silhouette. Runic-blue sigils on chest, helmet emblem, and carbine muzzle.

### Warden · Brannock — heavy plate, Dragonmaw Autocannon (draconic orange)

<p>
  <img src="public/styles/flat/soldier_warden.svg" width="240" alt="Warden Brannock"/>
</p>

Brown-and-bronze heavy armor, spiked pauldrons, crested helm, belt-fed autocannon with ember muzzle. The tank of the squad.

### Mystic · Seraphine — violet fae coat, Arclight Marksman (fae violet + runic blue)

<p>
  <img src="public/styles/flat/soldier_mystic.svg" width="240" alt="Mystic Seraphine"/>
</p>

Long fitted coat with trimmed skirt and pointed hem, silver filigree pauldrons, fae ocular monocle, silver braid, circlet with rune gems, swiftstep greaves. Carries a long-barreled sniper with copper rune coils around the barrel and a lightning-cored muzzle.

### Sapper · Orin — olive demolitions, Hexbore Scattergun (alchemical green + draconic orange)

<p>
  <img src="public/styles/flat/soldier_sapper.svg" width="240" alt="Sapper Orin"/>
</p>

Canvas duster over tactical vest, oakheart helm with wood-grain bands and alchemical sigil, goggles pushed up, gas-mask hose round the neck. A bandolier of shotgun shells crosses an alchemical vial bandolier, with four glowing Embercore Orbs hanging from the belt.

---

## Enemies

### Wraith Raider — ranged caster

<p>
  <img src="public/styles/flat/enemy.svg" width="240" alt="Wraith Raider"/>
</p>

Bone mask beneath a tattered hood, inner robe layer, chain cinch at the throat, rune-ringed staff with a crystal-set spectral blade, bone claws, floating sigils, swirling mist at the base.

### Gutter Troll — melee bruiser

<p>
  <img src="public/styles/flat/enemy_troll.svg" width="240" alt="Gutter Troll"/>
</p>

Hunched brute in patchwork scavenged armor, tusks and red eyes in deep sockets, a rusted cleaver in the off-hand and a raised spiked maul overhead.

---

## Tiles

<p>
  <img src="public/styles/flat/tiles.svg" width="480" alt="Flat vector tiles"/>
</p>

Isometric floor / half cover (chest-high crate) / full cover (wall).

---

## Class color logic

Each class carries two tags: **armor/clothing** (environmental/elemental) and **weapon** (often independent). Both are rendered as ambient accent colors so you can read loadout at a glance.

| Class  | Clothing   | Weapon accent          |
|--------|------------|------------------------|
| Ranger | Sand       | Runic blue (carbine)   |
| Warden | Draconic   | Draconic orange (autocannon) |
| Mystic | Fae violet | Runic blue (marksman)  |
| Sapper | Alchemical green | Alchemical green (scattergun) with draconic-orange embercore grenades on the belt |

---

## Next steps once you confirm the roster

1. Swap the placeholder rectangles in `PixiStage.tsx` for these SVGs (load via `Assets.load()`, depth-sort on `g.x + g.y`).
2. Add idle bob + aim-at-target variants per character.
3. Second tile biome (arcane foundry) reusing the same tile family.
4. Additional enemy archetypes: *Sigil Hound*, *Forgewraith*.

---

<details>
<summary>Original four-way A/B/C/D comparison (for reference)</summary>

### A · Pixel 16-bit
<p><img src="public/styles/pixel/soldier.svg" width="140"/> <img src="public/styles/pixel/enemy.svg" width="140"/> <img src="public/styles/pixel/tiles.svg" width="360"/></p>

### B · Flat vector (original, before detailing)
<p>(See detailed roster above.)</p>

### C · Painterly
<p><img src="public/styles/painterly/soldier.svg" width="140"/> <img src="public/styles/painterly/enemy.svg" width="140"/> <img src="public/styles/painterly/tiles.svg" width="360"/></p>

### D · Noir blueprint
<p><img src="public/styles/blueprint/soldier.svg" width="140"/> <img src="public/styles/blueprint/enemy.svg" width="140"/> <img src="public/styles/blueprint/tiles.svg" width="360"/></p>

</details>

# Sprite Style Exploration

You picked **Option B — Flat vector**. Below is the refined set with much more character detail plus a second class and a second enemy to show how the style holds up across the roster. Original comparison with the other three options is at the bottom.

---

## Refined Option B — Flat Vector, Detailed

Same flat-vector DNA (bold solid fills, 1–2 gradient stops per material, no outlines) but with a full gear pass: faceted chest plates, mag pouches, shoulder sigils, patch insignia, kneepads with straps, detailed rifle with scope/magazine/rune engravings, under-hood bone mask on the Wraith, spectral sigils, chain cinch, inner robe layers — the works.

### Ranger · Kestrel (Runeweave Carbine)

<p>
  <img src="public/styles/flat/soldier.svg" width="240" alt="Ranger with detailed kit"/>
</p>

Fast scout build: tactical helmet with flip-up NVG mount and rune emblem, chest rig with four mag pouches, shoulder sigil, drop-leg holster, kneepads, runic carbine with scope and barrel engravings.

### Warden · Brannock (Dragonmaw Autocannon)

<p>
  <img src="public/styles/flat/soldier_warden.svg" width="240" alt="Warden in heavy plate"/>
</p>

Heavy bulwark: full-face draconic helm with crest, oversized spiked pauldrons, layered chest plate with ember core, vambraces, studded gauntlets, heavy belt buckle, plated greaves, heat-shrouded belt-fed autocannon with ember muzzle.

### Wraith Raider (Spectral Blade)

<p>
  <img src="public/styles/flat/enemy.svg" width="240" alt="Wraith Raider enemy"/>
</p>

Ranged threat: bone mask beneath a tattered hood, chain cinch at the throat, inner robe layer, sash with focus sigil, bone claws, a rune-ringed haft and crystal-set spectral blade, violet eyes inside the mask sockets, floating sigils.

### Gutter Troll (Spiked Maul)

<p>
  <img src="public/styles/flat/enemy_troll.svg" width="240" alt="Gutter Troll enemy"/>
</p>

Melee bruiser: hunched stance with clawed bare feet, patchwork scavenged armor, chain sash, tusks and red eyes, scarred hide, rusted cleaver in the off-hand and a raised spike-maul overhead for scale.

### Tiles (unchanged)

<p>
  <img src="public/styles/flat/tiles.svg" width="480" alt="Flat vector tiles"/>
</p>

---

## How this fits the engine

- Each sprite is a single SVG, ~4–8 KB. Serveable as-is from `public/styles/flat/` — no sprite atlas needed for MVP.
- Color-coded rune/ember/sigil accents already match the tag palette in `src/game/types.ts` (`runic`=blue, `draconic`=orange, `fae`=violet, `alchemical`=green), so the same sprite can be re-tinted per weapon/armor tag.
- When we wire them into `PixiStage`, the `Assets.load()` path is one line and replaces the current colored placeholder rectangles.

## Next steps once you confirm

1. Produce the remaining two soldier classes (**Mystic** with Arclight Marksman, **Sapper** with Hexbore Scattergun) at the same level of detail.
2. Add idle + aimed-at + hit-flash variants per character.
3. Swap the placeholder rectangles in the renderer for these SVGs, depth-sorted on `g.x + g.y`.
4. Optional: 2 tile biomes (ruined market / arcane foundry) reusing the same tile family.

---

## Original four-way comparison (for reference)

<details>
<summary>Click to expand the original A / B / C / D comparison.</summary>

### A · Pixel 16-bit
<p><img src="public/styles/pixel/soldier.svg" width="140"/> <img src="public/styles/pixel/enemy.svg" width="140"/> <img src="public/styles/pixel/tiles.svg" width="360"/></p>

### B · Flat vector (original)
<p><img src="public/styles/flat/soldier.svg" width="140"/> <img src="public/styles/flat/enemy.svg" width="140"/> <img src="public/styles/flat/tiles.svg" width="360"/></p>

### C · Painterly
<p><img src="public/styles/painterly/soldier.svg" width="140"/> <img src="public/styles/painterly/enemy.svg" width="140"/> <img src="public/styles/painterly/tiles.svg" width="360"/></p>

### D · Noir blueprint
<p><img src="public/styles/blueprint/soldier.svg" width="140"/> <img src="public/styles/blueprint/enemy.svg" width="140"/> <img src="public/styles/blueprint/tiles.svg" width="360"/></p>

</details>

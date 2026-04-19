# Sprite Style Exploration

Full roster rebuilt to match the bone-white operator reference: carved ivory plate with ornamental engraving (crown / scroll / butterfly motifs), fur-edged shoulder mantles, full-face bone masks with visor lenses, heavy weathering, and dark tactical undersuit / weapons in stark contrast. Each class keeps its own silhouette and tag color as a small accent on specialist gear.

---

## Desert Scout Unit — bone-operator aesthetic

### Ranger · Kestrel — Runeweave Carbine (runic blue)

<p>
  <img src="public/styles/flat/soldier.svg" width="260" alt="Ranger Kestrel"/>
</p>

Scout mask with wide goggle visor, ridged brow crest, carved scout emblem, respirator vent. Fur mantle collar. Bone chest plate with engraved crown sigil (runic-blue gem centered). Suppressed modern carbine.

### Warden · Brannock — Dragonmaw Autocannon (draconic orange)

<p>
  <img src="public/styles/flat/soldier_warden.svg" width="260" alt="Warden Brannock"/>
</p>

Heavy bone skull helm with crown-spike ridge, forehead sigil, twin draconic visor lenses, chin respirator. Oversized scalloped pauldrons with bone horns. Layered ornate chest plate with a large engraved crown sigil (ember gem). Bone tabard hanging over the hips. Bone gauntlets with ember knuckle studs.

### Mystic · Seraphine — Arclight Marksman (fae violet + runic blue)

<p>
  <img src="public/styles/flat/soldier_mystic.svg" width="260" alt="Mystic Seraphine"/>
</p>

Slim ornate mask with butterfly/scarab-wing forehead engraving, temple scrolls, violet-lens slit visor, delicate chin point. Silver circlet with fae gems above the mask. Flowing bone-fur cloak trailing to the ground, fae-violet trim along the edges, ornate scarf draped over the shoulders. Slim bone plate with filigree swirls. Suppressed sniper with copper-rune coils.

### Sapper · Orin — Hexbore Scattergun (alchemical green)

<p>
  <img src="public/styles/flat/soldier_sapper.svg" width="260" alt="Sapper Orin"/>
</p>

Bone mask with twin round alchemical-green goggle lenses and a prominent **respirator canister** at the mouth, dual hoses running to the shoulders. Fur mantle. Utility belt loaded with four **Embercore Orbs** (glowing orange) + tool pouches. Alchemical-vial bandolier crosses a shotgun-shell bandolier over the bone chest plate. Tactical double-barrel scattergun with side alchemical vial and green muzzle glow. The grimiest of the four — heavier weathering streaks.

---

## Unit identity

Shared across all four:
- **Bone-white carved plate** (`#f0ead8` → `#4a3e28`) with weathering streaks and engraved filigree
- **Dark tactical undersuit** (`#2a251e` → `#0a0806`) at joints and neck
- **Fur-edged shoulder mantle** in desert tones (`#d4c8b0` → `#3a3020`) with zig-zag shaggy edge
- **Cream scarf / shemagh** tucked under the mask
- **Full-face bone mask** with visor lens + respirator / mouth vent
- **NVG/rangefinder mount** on top of every helmet
- **Runic-blue squad sigil** (small diamond) carved into both pauldrons
- **Dark modern tactical weapons** with suppressors / optics, and a class-tag muzzle-core glow

Class tag color appears only on:

| Class  | Tag              | Class-specific accents                                             |
|--------|------------------|---------------------------------------------------------------------|
| Ranger | Runic blue       | chest sigil gem, visor sensor, carbine muzzle                       |
| Warden | Draconic orange  | visor lenses, crown-sigil gem, knuckle studs, autocannon muzzle     |
| Mystic | Fae violet       | visor lens, crest gem, sigil gem, circlet, cloak trim, pauldron gem |
| Sapper | Alchemical green | both goggle lenses, filter glow, chest sigil gem, scattergun muzzle |

(Independent weapon-tag rule: the Mystic's Arclight Marksman is a *runic* weapon, so its coil wraps and muzzle core remain runic-blue even though she's a fae class.)

---

## Enemies

### Wraith Raider
<p><img src="public/styles/flat/enemy.svg" width="240"/></p>

### Gutter Troll
<p><img src="public/styles/flat/enemy_troll.svg" width="240"/></p>

(Enemies not yet re-skinned to match the bone-operator direction — they'll be updated next pass so the squad reads heroic against a distinct enemy silhouette.)

## Tiles
<p><img src="public/styles/flat/tiles.svg" width="480"/></p>

---

## Next steps once you confirm the squad

1. Re-skin enemies (Wraith, Troll) to be visually distinct from the squad — darker tones, cruder armor, no carved filigree.
2. Swap the placeholder rectangles in `PixiStage.tsx` for these SVGs.
3. Add idle bob + aim-at-target variants per character.
4. Second tile biome (sand-ruin oasis) matching the unit.

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

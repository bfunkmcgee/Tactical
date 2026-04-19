# Sprite Style Exploration

Four direction options for soldier, enemy (Wraith Raider), and tileset. All are production-reasonable SVGs that scale cleanly and render fast on mobile. Pick whichever feel fits best — the engine and HUD already support the whole catalog unchanged.

> **How to view:** GitHub renders SVGs inline. Click any sprite below to see it at full size. A live side-by-side page also exists at `public/style-exploration.html` if you clone the branch and run `npm run dev`.

---

## Option A · Pixel 16-bit

Crunchy, deliberate pixels with a small palette. Reads instantly on phone screens and gives soldiers strong silhouettes.

<p>
  <img src="public/styles/pixel/soldier.svg" width="160" alt="Pixel soldier"/>
  <img src="public/styles/pixel/enemy.svg" width="160" alt="Pixel enemy"/>
  <img src="public/styles/pixel/tiles.svg" width="400" alt="Pixel tiles"/>
</p>

- ✅ Extremely fast to author — 2–4 hours per soldier.
- ✅ Readable at the smallest sizes (zoomed-out tactical camera).
- ✅ Animation is cheap (2–4 frame walk cycles look great).
- ❌ Looks retro — may feel dated for a modern-era pitch.
- ❌ Less room for flashy FX without breaking the aesthetic.

---

## Option B · Flat vector

Bold shapes, subtle gradients, no outlines. Modern mobile strategy vibe — clean silhouettes with rune-blue accents. Scales crisply at any resolution.

<p>
  <img src="public/styles/flat/soldier.svg" width="160" alt="Flat soldier"/>
  <img src="public/styles/flat/enemy.svg" width="160" alt="Flat enemy"/>
  <img src="public/styles/flat/tiles.svg" width="400" alt="Flat tiles"/>
</p>

- ✅ Scales to any device pixel density without rework.
- ✅ Fastest to iterate — all characters are composable shapes.
- ✅ Easy to re-tint per elemental tag (runic / draconic / fae).
- ❌ Can feel generic if palette isn't strong.
- ❌ Less "handmade" character than pixel or painterly.

---

## Option C · Painterly

Warm gradients and soft edges — bronze, ember, deep shadow. Sells the *fantasy* side more than the *modern* side. Feels like a hand-illustrated game.

<p>
  <img src="public/styles/painterly/soldier.svg" width="160" alt="Painterly soldier"/>
  <img src="public/styles/painterly/enemy.svg" width="160" alt="Painterly enemy"/>
  <img src="public/styles/painterly/tiles.svg" width="400" alt="Painterly tiles"/>
</p>

- ✅ Strongest mood — most memorable art direction.
- ✅ Embers/glows fit naturally with draconic & alchemical tags.
- ❌ Slowest to author — each sprite needs care.
- ❌ Soft edges hurt readability at small zoom on phones.
- ❌ Shifts brand: feels more D&D, less modern tactical.

---

## Option D · Noir blueprint

Two-tone wireframe aesthetic — runic cyan on near-black, enemies in violet, draconic/ember accents in orange. Every frame feels like a tactical overlay.

<p>
  <img src="public/styles/blueprint/soldier.svg" width="160" alt="Blueprint soldier"/>
  <img src="public/styles/blueprint/enemy.svg" width="160" alt="Blueprint enemy"/>
  <img src="public/styles/blueprint/tiles.svg" width="400" alt="Blueprint tiles"/>
</p>

- ✅ Fantasy-modern duality built into the style itself.
- ✅ Strongest *tactical HUD* feel — ties into the cover/LOS overlays.
- ✅ One sprite doubles as its own icon.
- ❌ Limited palette can feel cold — worlds read as one-note.
- ❌ Legibility depends on glow FX staying consistent.

---

Tell me **A**, **B**, **C**, or **D** (or a mix — e.g. "B with C's palette") and I'll wire the choice into the renderer, build out the full soldier and enemy roster in that style, and add simple idle animations.

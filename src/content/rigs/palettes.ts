/**
 * Curated palette swatches for human-rig appearance. Used by the
 * (future) character creation UI as selectable choices, and referenced
 * at template-authoring time when composing default `HumanAppearance`
 * values for the four Eagle Corps soldiers.
 *
 * Each list is intentionally small and diverse rather than exhaustive —
 * the goal is "enough distinct options to feel like choice" without a
 * UI surface that becomes a color-picker.
 *
 * All values are 24-bit RGB hex. Stable id strings let content author
 * defaults symbolically (e.g. `skinTone: SKIN_TONES[1].color`).
 */

export interface PaletteSwatch {
  id: string;
  name: string;
  color: number;
}

/** Five skin tones, lightest to deepest. */
export const SKIN_TONES: readonly PaletteSwatch[] = [
  { id: 'fair',   name: 'Fair',   color: 0xe8c4a4 },
  { id: 'medium', name: 'Medium', color: 0xc48a6a },
  { id: 'tan',    name: 'Tan',    color: 0x9a6a4a },
  { id: 'deep',   name: 'Deep',   color: 0x6a4030 },
  { id: 'rich',   name: 'Rich',   color: 0x3a2018 },
] as const;

/** Six hair colors covering natural tones. */
export const HAIR_COLORS: readonly PaletteSwatch[] = [
  { id: 'black',  name: 'Black',  color: 0x1a1410 },
  { id: 'brown',  name: 'Brown',  color: 0x4a3020 },
  { id: 'auburn', name: 'Auburn', color: 0x7a3a20 },
  { id: 'blond',  name: 'Blond',  color: 0xd4b080 },
  { id: 'grey',   name: 'Grey',   color: 0x8a8478 },
  { id: 'white',  name: 'White',  color: 0xe8e4d8 },
] as const;

/** Five eye colors. Eye rendering is deferred — the palette is
 *  authored now so templates can reference it once the head-overlay
 *  mechanism ships. */
export const EYE_COLORS: readonly PaletteSwatch[] = [
  { id: 'brown', name: 'Brown', color: 0x3a2a1c },
  { id: 'hazel', name: 'Hazel', color: 0x6a4a28 },
  { id: 'green', name: 'Green', color: 0x3a5a3a },
  { id: 'blue',  name: 'Blue',  color: 0x4a6a9a },
  { id: 'grey',  name: 'Grey',  color: 0x6a7078 },
] as const;

/** Shorthand color-only lookups. */
export const skinToneByIdMap: Record<string, number> =
  Object.fromEntries(SKIN_TONES.map((s) => [s.id, s.color]));
export const hairColorByIdMap: Record<string, number> =
  Object.fromEntries(HAIR_COLORS.map((h) => [h.id, h.color]));
export const eyeColorByIdMap: Record<string, number> =
  Object.fromEntries(EYE_COLORS.map((e) => [e.id, e.color]));

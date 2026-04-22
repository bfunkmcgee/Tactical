import type { Rig, RigPartId } from '../../game/engine/rig';

/**
 * Standard human rig — the authoritative body layout for any player
 * soldier or human-like enemy that opts into the rig via
 * `SoldierTemplate.appearance`.
 *
 * ── SVG authoring spec (for the artist) ─────────────────────────────
 *
 * Every part SVG must use `viewBox="0 0 96 128"` — the same frame the
 * existing monolithic soldier/enemy SVGs use, so the rig scales and
 * positions identically at render time.
 *
 * The torso origin is the top-left of the viewBox. Every joint offset
 * below is given in that frame, at natural scale 1.0. The renderer
 * applies one uniform scale (0.42 today) across all parts so anchors
 * stay aligned.
 *
 * Skin patches — bits of the head, neck, and exposed forearms — should
 * be authored with `class="skin"` on the <path> element. The renderer
 * tints those paths via `HumanAppearance.skinTone`; other paths are
 * unaffected, so cloth and metal retain their authored color.
 *
 * Hair is NOT part of the rig — it's authored as a separate 32×32 SVG
 * centered on `joints.head`, sourced from `pack.hairStyles`, so different
 * packs can ship different hair catalogs without engine changes.
 *
 * The five part SVGs should visually register against each other when
 * stacked in `parts` draw order. A reference-grid SVG at
 * `/styles/flat/human/human_reference_grid.svg` shows the joint anchors
 * as crosshairs so the artist can align against a common grid.
 */
export const HUMAN_RIG: Rig = {
  id: 'human',
  viewBox: { w: 96, h: 128 },
  joints: {
    'head':       { offset: { x: 48, y: 22 } },
    'neck':       { offset: { x: 48, y: 42 } },
    'shoulder-l': { offset: { x: 36, y: 52 } },
    'shoulder-r': { offset: { x: 60, y: 52 } },
    'waist':      { offset: { x: 48, y: 82 } },
    'grip':       { offset: { x: 48, y: 72 } }, // matches existing GRIP_ANCHOR
    'foot-l':     { offset: { x: 40, y: 120 } },
    'foot-r':     { offset: { x: 56, y: 120 } },
  },
  parts: ['legs', 'torso', 'arms-back', 'head', 'arms-front'],
};

/** Part-id → SVG path. Loaded into the sprite cache at mount under keys
 *  `rig:human:legs`, `rig:human:torso`, etc. */
export const HUMAN_RIG_SVG: Record<RigPartId, string> = {
  'legs':       '/styles/flat/human/human_legs.svg',
  'torso':      '/styles/flat/human/human_torso.svg',
  'arms-back':  '/styles/flat/human/human_arms_back.svg',
  'head':       '/styles/flat/human/human_head.svg',
  'arms-front': '/styles/flat/human/human_arms_front.svg',
};

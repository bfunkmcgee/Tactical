import type { CSSProperties } from 'react';
import type { SoldierTemplate } from '../game/types';

/**
 * Cheap DOM-only soldier portrait. Shows the soldier's head SVG as an
 * <img> (taking the partOverrides.head URL if set, falling back to the
 * shared rig head for custom-created soldiers without per-part art).
 * For non-rigged templates, falls back to a flat `portraitColor` square
 * — matches the pre-rig LoadoutScreen thumbnail look.
 *
 * Deliberately NOT a Pixi canvas like `RigPreview`. A roster picker
 * shows 4+ portraits at once; spinning up 4 Applications for a static
 * thumbnail would be wasteful. The head SVGs are small enough that the
 * browser caches them after first fetch.
 *
 * Hair is intentionally omitted: CSS-tinting an SVG to match
 * `appearance.hairColor` requires feColorMatrix filters or inline-SVG
 * content rewriting, both of which are heavier than this thumbnail
 * warrants. The face + authored skin color + eye color is already a
 * strong upgrade over a solid color square.
 */

const GENERIC_HUMAN_HEAD = '/styles/flat/human/human_head.svg';

export interface SoldierPortraitProps {
  template: SoldierTemplate;
  /** Render size in CSS pixels. Defaults to 48. */
  size?: number;
  /** Extra styles merged onto the root element. */
  style?: CSSProperties;
}

export default function SoldierPortrait({
  template, size = 48, style,
}: SoldierPortraitProps) {
  const headUrl = template.appearance?.partOverrides?.head ?? (
    template.appearance ? GENERIC_HUMAN_HEAD : null
  );

  const baseStyle: CSSProperties = {
    width: size,
    height: size,
    borderRadius: 'var(--r-md)',
    flexShrink: 0,
    overflow: 'hidden',
    ...style,
  };

  if (!headUrl) {
    // Non-rigged template: fall back to the legacy flat-color square.
    return (
      <div style={{ ...baseStyle, background: template.portraitColor }} />
    );
  }

  // Head SVGs are authored in a 96×128 viewBox, with the face near the
  // top. Scale-to-fit on the width; position the image so the face
  // region lands at the portrait center rather than stretching the
  // full body into the thumbnail.
  return (
    <div style={{
      ...baseStyle,
      background: 'var(--bg-2)',
      position: 'relative',
    }}>
      <img
        src={headUrl}
        alt={template.name}
        style={{
          position: 'absolute',
          // The face in a 96×128 rig SVG sits roughly at y = 10–42. With
          // a 3× scale we crop so that band lands centered in the
          // portrait: width 3× the frame width, offset left to keep the
          // face column centered; Y offset drops the bottom 2/3 of the
          // body off-screen.
          width: size * 3,
          height: size * 3 * (128 / 96),
          left: -size,
          top: -size * 0.35,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { Loadout, SoldierTemplate } from '../game/types';
import { useContent } from '../content/registry';
import RigPreview from './RigPreview';

/**
 * Cheap DOM-only soldier portrait. Shows the soldier's head SVG as an
 * <img> (taking the partOverrides.head URL if set, falling back to the
 * shared rig head for custom-created soldiers without per-part art)
 * plus a mask-tinted hair layer on top for a richer thumbnail.
 *
 * Deliberately NOT a Pixi canvas like `RigPreview`. A roster picker
 * shows 4+ portraits at once; spinning up 4 Applications for a static
 * thumbnail would be wasteful. The head SVGs are small enough that the
 * browser caches them after first fetch.
 *
 * Hair coloring (Phase 6b) uses CSS `mask-image` + `background-color`
 * to tint the hair silhouette at render time — no feColorMatrix, no
 * inline SVG rewriting, just a solid color block clipped by the hair
 * SVG's alpha. Works in all modern browsers.
 *
 * Helmet overlay from `loadout.armor.helmet` is NOT currently shown —
 * the portrait only knows the template, not the loadout. A future polish
 * pass could accept a `loadout` prop and layer the helmet piece's visual
 * on top; deferred out of 6b scope.
 */

const GENERIC_HUMAN_HEAD = '/styles/flat/human/human_head.svg';

const portraitSnapshotCache = new Map<string, string>();
const portraitSnapshotWaiters = new Map<string, Set<(url: string) => void>>();
const portraitSnapshotInFlight = new Set<string>();

function stableLoadoutKey(loadout: Loadout | undefined): string {
  if (!loadout) return 'none';
  const armor = Object.keys(loadout.armor).sort().map((k) => `${k}:${loadout.armor[k as keyof Loadout['armor']]}`).join('|');
  const pmods = Object.keys(loadout.primaryMods).sort().map((k) => `${k}:${loadout.primaryMods[k as keyof Loadout['primaryMods']]}`).join('|');
  const smods = Object.keys(loadout.sidearmMods).sort().map((k) => `${k}:${loadout.sidearmMods[k as keyof Loadout['sidearmMods']]}`).join('|');
  const clothing = (loadout.clothingIds ?? []).join(',');
  return [
    loadout.primaryId, pmods, loadout.sidearmId, smods, armor,
    (loadout.utilityIds ?? []).join(','), loadout.kitId ?? '', clothing,
  ].join('~');
}

export interface SoldierPortraitProps {
  template: SoldierTemplate;
  loadout?: Loadout;
  /** Render size in CSS pixels. Defaults to 48. */
  size?: number;
  /** Extra styles merged onto the root element. */
  style?: CSSProperties;
}

export default function SoldierPortrait({
  template, loadout, size = 48, style,
}: SoldierPortraitProps) {
  const headUrl = template.appearance?.partOverrides?.head ?? (
    template.appearance ? GENERIC_HUMAN_HEAD : null
  );
  const snapshotKey = useMemo(
    () => (template.appearance
      ? `${template.id}::${size}::${JSON.stringify(template.appearance)}::${stableLoadoutKey(loadout)}`
      : null),
    [template, size, loadout],
  );
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(
    snapshotKey ? portraitSnapshotCache.get(snapshotKey) ?? null : null,
  );
  const [isSnapshotOwner, setIsSnapshotOwner] = useState<boolean>(false);

  // Resolve the hair overlay URL (if any) from the active pack's
  // hairStyles catalog. Unknown style ids / missing catalog → no hair.
  const pack = useContent();
  const hairStyle = template.appearance?.hairStyle;
  const hairUrl = hairStyle ? pack.hairStyles?.[hairStyle]?.svg : undefined;
  const hairColor = template.appearance?.hairColor;

  const baseStyle: CSSProperties = {
    width: size,
    height: size,
    borderRadius: 'var(--r-md)',
    flexShrink: 0,
    overflow: 'hidden',
    ...style,
  };

  useEffect(() => {
    if (!snapshotKey) return;
    const cached = portraitSnapshotCache.get(snapshotKey) ?? null;
    setSnapshotUrl(cached);
    if (cached) { setIsSnapshotOwner(false); return; }

    const waiters = portraitSnapshotWaiters.get(snapshotKey) ?? new Set<(url: string) => void>();
    const waiter = (url: string) => setSnapshotUrl(url);
    waiters.add(waiter);
    portraitSnapshotWaiters.set(snapshotKey, waiters);
    if (!portraitSnapshotInFlight.has(snapshotKey)) {
      portraitSnapshotInFlight.add(snapshotKey);
      setIsSnapshotOwner(true);
    } else {
      setIsSnapshotOwner(false);
    }
    return () => {
      const setForKey = portraitSnapshotWaiters.get(snapshotKey);
      if (!setForKey) return;
      setForKey.delete(waiter);
      if (setForKey.size === 0) portraitSnapshotWaiters.delete(snapshotKey);
    };
  }, [snapshotKey]);

  if (!headUrl) {
    // Non-rigged template: fall back to the legacy flat-color square.
    return (
      <div style={{ ...baseStyle, background: template.portraitColor }} />
    );
  }

  if (template.appearance && snapshotUrl) {
    return (
      <img
        src={snapshotUrl}
        alt={template.name}
        style={{ ...baseStyle, background: '#1a1a22', display: 'block' }}
      />
    );
  }

  if (template.appearance && isSnapshotOwner) {
    return (
      <RigPreview
        appearance={template.appearance}
        loadout={loadout}
        framing="portrait"
        width={size}
        height={size}
        onSnapshot={(url) => {
          if (!snapshotKey) return;
          if (!portraitSnapshotCache.has(snapshotKey)) {
            portraitSnapshotCache.set(snapshotKey, url);
          }
          portraitSnapshotInFlight.delete(snapshotKey);
          setSnapshotUrl(url);
          const waiters = portraitSnapshotWaiters.get(snapshotKey);
          if (!waiters) return;
          waiters.forEach((notify) => notify(url));
          portraitSnapshotWaiters.delete(snapshotKey);
        }}
      />
    );
  }

  if (template.appearance) {
    return <div style={{ ...baseStyle, background: '#1a1a22' }} />;
  }

  // Head SVGs are authored in a 96×128 viewBox, with the face near the
  // top. Scale-to-fit on the width; position the image so the face
  // region lands at the portrait center rather than stretching the
  // full body into the thumbnail.
  const layerStyle: CSSProperties = {
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
  };
  return (
    <div style={{
      ...baseStyle,
      background: 'var(--bg-2)',
      position: 'relative',
    }}>
      <img src={headUrl} alt={template.name} style={layerStyle} />
      {hairUrl && hairColor !== undefined && (
        // Mask-tinted hair: a solid color block clipped by the hair
        // SVG's alpha. Uses the same layer transform as the head so
        // it lines up exactly — hair assets are authored in the same
        // 96×128 rig frame.
        <div
          aria-hidden
          style={{
            ...layerStyle,
            backgroundColor: `#${hairColor.toString(16).padStart(6, '0')}`,
            WebkitMaskImage: `url(${hairUrl})`,
            maskImage: `url(${hairUrl})`,
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
            WebkitMaskSize: '100% 100%',
            maskSize: '100% 100%',
          }}
        />
      )}
    </div>
  );
}

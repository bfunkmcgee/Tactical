import { useLayoutEffect, useRef, type ReactNode } from 'react';

/**
 * Single fixed wrapper at the bottom of the screen that owns both
 * the SelectedUnitHeader (when a unit is selected) and the ActionBar.
 *
 * Replaces the prior arrangement of two independently-fixed siblings,
 * where the header's `bottom: calc(var(--safe-bottom) + 72px)`
 * assumed a 2-row action bar — so when a tall bar (with utilities +
 * class ability + Refit) wrapped to 4 rows, the header was hidden
 * behind it. Stacking both as flow children of a single deck means
 * they're guaranteed to read as a connected control surface
 * regardless of the bar's settled height.
 */
export interface ControlDeckProps {
  /** Selected-unit context strip. Pass `null` when no unit is selected. */
  header: ReactNode | null;
  /** The action bar. Always rendered as the deck's bottom child. */
  bar: ReactNode;
}

export default function ControlDeck({ header, bar }: ControlDeckProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Publish the deck's settled height to `--control-deck-h` on :root so the
  // floating overlays (pending shot/utility cards, action overflow sheet) can
  // anchor their `bottom` just above the bar — no matter how many rows it
  // wraps to on a narrow phone. Mirrors this deck's own raison d'être (see
  // the doc-comment above): position relative to the real height, never a
  // hardcoded row count.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const publish = () => {
      root.style.setProperty('--control-deck-h', `${el.offsetHeight}px`);
    };
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty('--control-deck-h');
    };
  }, []);

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        bottom: 'calc(var(--safe-bottom) + var(--s-2))',
        left: 'var(--s-2)',
        right: 'var(--s-2)',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--s-1)',
        pointerEvents: 'none', // children re-enable on themselves
      }}
    >
      {header}
      {bar}
    </div>
  );
}

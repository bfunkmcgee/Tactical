import type { ReactNode } from 'react';

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
  return (
    <div
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

import { useState } from 'react';
import type { ActionDescriptor, ActionGroups, ActionId } from './groupActions';
import { pickOverflow } from './groupActions';

/**
 * Bottom action bar — renders the four descriptor groups produced by
 * `groupActions` separated by `--bg-2` rules. End Turn keeps the gold
 * primary fill; selected modes (Move / Fire / Sidearm / utilities)
 * get a gold border via `descriptor.active`.
 *
 * If the total visible button count would exceed `MAX_VISIBLE_ACTIONS`,
 * `pickOverflow` trims tail entries from the `class` group into a
 * "..." button that opens a small sheet — keeps the bar at ≤ 2 rows
 * on a 360px phone.
 */

export interface ActionBarProps {
  groups: ActionGroups;
  onAction: (id: ActionId) => void;
}

function buttonStyle(d: ActionDescriptor, primary: boolean): React.CSSProperties {
  return {
    borderColor: d.active ? 'var(--accent)' : undefined,
    flex: primary ? undefined : '0 0 auto',
  };
}

function renderButton(d: ActionDescriptor, onAction: (id: ActionId) => void, opts: { primary?: boolean } = {}) {
  const primary = d.id === 'endTurn';
  // Render the short label so the bar fits in 1-2 rows on a 360px
  // viewport. The full label (e.g. "Fire · Hexbore Scattergun 3/3")
  // becomes the aria-label so screen readers still announce the
  // weapon name; the SelectedUnitHeader carries it visually.
  const visibleText = d.shortLabel ?? d.label;
  // When disabled, surface the reason via the HTML title attribute
  // (long-press tooltip on touch / hover on desktop) and extend the
  // aria-label so screen readers announce both action and reason.
  const ariaLabel = d.disabled && d.disabledReason
    ? `${d.label} · disabled: ${d.disabledReason}`
    : d.label;
  const titleAttr = d.disabled && d.disabledReason ? d.disabledReason : undefined;
  return (
    <button
      key={d.id}
      type="button"
      className={primary ? 'primary' : undefined}
      onClick={() => onAction(d.id)}
      disabled={d.disabled}
      aria-label={ariaLabel}
      title={titleAttr}
      style={buttonStyle(d, !!opts.primary || primary)}
    >
      {visibleText}
    </button>
  );
}

function Group({
  items, onAction, leading,
}: { items: ActionDescriptor[]; onAction: (id: ActionId) => void; leading: boolean }) {
  if (items.length === 0) return null;
  return (
    <div
      className="row"
      style={{
        gap: 'var(--s-1)',
        flexShrink: 0,
        paddingLeft: leading ? 0 : 'var(--s-2)',
        marginLeft: leading ? 0 : 'var(--s-1)',
        borderLeft: leading ? 'none' : '1px solid var(--bg-2)',
      }}
    >
      {items.map((d) => renderButton(d, onAction))}
    </div>
  );
}

export default function ActionBar({ groups, onAction }: ActionBarProps) {
  const [overflowOpen, setOverflowOpen] = useState(false);
  const { visible, overflow } = pickOverflow(groups);

  return (
    <>
      <div
        style={{
          // No `position: fixed` — the bar is a flow child of
          // <ControlDeck>. Predictable stacking with the
          // selected-unit header above.
          display: 'flex',
          gap: 0,
          flexWrap: 'wrap',
          alignItems: 'stretch',
          background: 'rgba(11,15,20,0.85)',
          border: '1px solid var(--bg-3)',
          borderRadius: 'var(--r-lg)',
          padding: 'var(--s-2)',
          backdropFilter: 'blur(6px)',
          pointerEvents: 'auto',
        }}
      >
        <Group items={visible.primary}   onAction={onAction} leading />
        <Group items={visible.utilities} onAction={onAction} leading={visible.primary.length === 0} />
        <Group items={visible.class}     onAction={onAction}
          leading={visible.primary.length === 0 && visible.utilities.length === 0} />
        {overflow.length > 0 && (
          <button
            type="button"
            onClick={() => setOverflowOpen((v) => !v)}
            aria-label="More actions"
            aria-expanded={overflowOpen}
            style={{
              marginLeft: 'var(--s-1)',
              borderColor: overflowOpen ? 'var(--accent)' : undefined,
              flexShrink: 0,
            }}
          >
            …
          </button>
        )}
        <div style={{ flex: 1 }} />
        <Group items={visible.system} onAction={onAction} leading={false} />
      </div>

      {/* Overflow sheet */}
      {overflowOpen && overflow.length > 0 && (
        <div
          onClick={() => setOverflowOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 11,
            pointerEvents: 'auto',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="panel stack"
            style={{
              position: 'fixed',
              right: 'var(--s-2)',
              bottom: 'calc(var(--safe-bottom) + 144px)',
              padding: 'var(--s-2)',
              gap: 'var(--s-1)',
              minWidth: 180,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}
          >
            {overflow.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => { onAction(d.id); setOverflowOpen(false); }}
                disabled={d.disabled}
                style={{ width: '100%', textAlign: 'left' }}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

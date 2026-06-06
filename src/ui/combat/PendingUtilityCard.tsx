import type { Utility } from '../../game/types';

/**
 * Pending-utility confirmation card. Mirrors <PendingShotCard>'s layout
 * for utility throws (frags, smokes, draughts). Shows the utility name,
 * radius, and effect summary. Confirm executes the throw; cancel returns
 * the unit to idle without consuming a charge.
 */
export interface PendingUtilityCardProps {
  utility: Utility;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function PendingUtilityCard({
  utility, onConfirm, onCancel,
}: PendingUtilityCardProps) {
  return (
    <div
      role="dialog"
      aria-label={`Utility preview: ${utility.name}, radius ${utility.radius}`}
      className="panel"
      style={{
        position: 'fixed', left: '50%', transform: 'translateX(-50%)',
        bottom: 'calc(var(--safe-bottom) + var(--s-2) + var(--control-deck-h) + var(--s-1))',
        zIndex: 11,
        minWidth: 240, padding: 'var(--s-3)', pointerEvents: 'auto',
        borderColor: 'var(--accent-2)',
        animation: 'deckCardGlow 1.6s ease-in-out infinite',
      }}
    >
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <strong>{utility.name}</strong>
        <span style={{ fontSize: 12, color: 'var(--accent-2)' }}>radius {utility.radius}</span>
      </div>
      <div style={{ fontSize: 13, color: 'var(--fg-1)', marginBottom: 8 }}>
        {effectSummary(utility)}
      </div>
      <div className="row" style={{ gap: 'var(--s-2)' }}>
        <button style={{ flex: 1 }} onClick={onCancel}>Cancel</button>
        <button className="primary" style={{ flex: 1 }} onClick={onConfirm}>Throw</button>
      </div>
    </div>
  );
}

function effectSummary(u: Utility): string {
  if (u.dmgMin !== undefined) return `${u.dmgMin}–${u.dmgMax} dmg in radius`;
  if (u.kind === 'smoke')     return `Drops smoke that blocks line of sight for 2 rounds`;
  if (u.heal)                 return `Heals ${u.heal} to adjacent ally`;
  return `Applies ${u.kind}`;
}

import type { ShotPreview, Unit } from '../../game/types';

/**
 * Pending-shot confirmation card. Floats above the action bar with the
 * target's name + cover state, hit/crit/damage bands, and the modifier
 * stack that produced the hit chance. Confirm fires the shot; cancel
 * returns the unit to idle without consuming AP.
 */
export interface PendingShotCardProps {
  preview: ShotPreview;
  target: Unit;
  usesSidearm: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function PendingShotCard({
  preview, target, usesSidearm, onConfirm, onCancel,
}: PendingShotCardProps) {
  return (
    <div
      role="dialog"
      aria-label={`Shot preview: ${target.name}, hit ${preview.hitChance}%`}
      className="panel"
      style={{
        position: 'fixed', left: '50%', transform: 'translateX(-50%)',
        bottom: 'calc(var(--safe-bottom) + 152px)', zIndex: 11,
        minWidth: 260, maxWidth: 320, padding: 'var(--s-3)', pointerEvents: 'auto',
        borderColor: 'var(--danger)',
      }}
    >
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <strong style={{ color: 'var(--fg-0)' }}>
          {usesSidearm ? '🔫 Sidearm' : 'Target'}: {target.name}
        </strong>
        <span style={{ fontSize: 12, color: coverColor(preview.cover) }}>
          {preview.cover === 'none' ? 'flanked' : `${preview.cover} cover`}
        </span>
      </div>
      <div className="row" style={{ gap: 'var(--s-4)', fontSize: 14, marginBottom: 6 }}>
        <span><span style={{ color: 'var(--fg-2)' }}>hit</span> <strong>{preview.hitChance}%</strong></span>
        <span><span style={{ color: 'var(--fg-2)' }}>crit</span> <strong>{preview.critChance}%</strong></span>
        <span><span style={{ color: 'var(--fg-2)' }}>dmg</span> <strong>{preview.dmgMin}–{preview.dmgMax}</strong></span>
      </div>
      <div style={{
        fontSize: 11, color: 'var(--fg-2)', marginBottom: 8,
        borderTop: '1px solid var(--bg-3)', paddingTop: 6,
      }}>
        {preview.modifiers.map((m, i) => (
          <span key={i} style={{ marginRight: 8 }}>
            <span style={{
              color: m.value < 0 ? 'var(--danger)'
                : m.value > 0 ? 'var(--success)' : 'var(--fg-2)',
            }}>
              {m.value > 0 ? '+' : ''}{m.value}
            </span> {m.label}
          </span>
        ))}
      </div>
      <div className="row" style={{ gap: 'var(--s-2)' }}>
        <button style={{ flex: 1 }} onClick={onCancel}>Cancel</button>
        <button className="primary" style={{ flex: 1 }} onClick={onConfirm}>
          {usesSidearm ? 'Pistol' : 'Fire'}
        </button>
      </div>
    </div>
  );
}

function coverColor(c: string): string {
  if (c === 'full') return 'var(--accent)';
  if (c === 'half') return 'var(--warn)';
  return 'var(--danger)';
}

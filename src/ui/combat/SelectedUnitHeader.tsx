import SoldierPortrait from '../SoldierPortrait';
import type { SoldierTemplate, Unit } from '../../game/types';

/**
 * Selected-unit context strip — sits between the map and the action
 * bar, surfaces the active soldier's portrait + name + class + HP +
 * AP. Visible only when a player unit is selected. Replaces the
 * eye-traversal from "name in roster pip up top" → "buttons at the
 * bottom" with a single focal point right above the actions.
 *
 * Presentational only: no store reads, all data via props.
 */
export interface SelectedUnitHeaderProps {
  unit: Unit | null;
  template: SoldierTemplate | null;
}

export function apDots(ap: number, apMax: number): { filled: number; empty: number } {
  const a = Math.max(0, Math.min(ap, apMax));
  return { filled: a, empty: Math.max(0, apMax - a) };
}

function hpBarColor(hp: number, hpMax: number): string {
  const pct = hpMax > 0 ? hp / hpMax : 0;
  if (pct >= 0.66) return 'var(--success)';
  if (pct >= 0.34) return 'var(--warn)';
  return 'var(--danger)';
}

export default function SelectedUnitHeader({ unit, template }: SelectedUnitHeaderProps) {
  if (!unit || unit.faction !== 'player' || !unit.alive) return null;
  const dots = apDots(unit.ap, unit.apMax);
  const hpPct = unit.hpMax > 0 ? Math.max(0, unit.hp) / unit.hpMax : 0;
  const lowHP = hpPct < 0.34;
  const overwatch = unit.status.overwatch;
  const borderColor = overwatch ? 'var(--accent)' : 'var(--bg-3)';

  return (
    <div
      role="status"
      aria-label={`${unit.name}, ${unit.hp} of ${unit.hpMax} HP, ${unit.ap} of ${unit.apMax} AP`}
      style={{
        position: 'fixed',
        left: 'var(--s-2)',
        right: 'var(--s-2)',
        bottom: 'calc(var(--safe-bottom) + 72px)',
        zIndex: 10,
        height: 52,
        padding: '6px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--s-3)',
        background: 'rgba(11,15,20,0.85)',
        border: `1px solid ${borderColor}`,
        borderRadius: 'var(--r-md)',
        backdropFilter: 'blur(6px)',
        boxShadow: lowHP ? 'inset 0 0 0 1px var(--danger)' : 'none',
        pointerEvents: 'auto',
      }}
    >
      {template && <SoldierPortrait template={template} size={40} />}
      <div className="stack" style={{ flex: 1, gap: 2, minWidth: 0 }}>
        <div className="row" style={{ gap: 'var(--s-2)', alignItems: 'baseline' }}>
          <strong style={{ fontSize: 14, color: 'var(--fg-0)' }}>{unit.name}</strong>
          <span style={{
            fontSize: 11, color: 'var(--fg-2)',
            textTransform: 'uppercase', letterSpacing: 0.6,
          }}>
            {template?.class ?? ''}
          </span>
        </div>
        <div className="row" style={{ gap: 'var(--s-2)', alignItems: 'center' }}>
          {/* HP bar */}
          <div style={{
            width: 60, height: 4,
            background: 'var(--bg-3)', borderRadius: 2,
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${hpPct * 100}%`, height: '100%',
              background: hpBarColor(unit.hp, unit.hpMax),
              transition: 'width 0.18s ease',
            }} />
          </div>
          <span style={{ fontSize: 11, color: 'var(--fg-1)' }}>
            {unit.hp}/{unit.hpMax}
          </span>
          {/* AP dots */}
          <div className="row" style={{ gap: 4, marginLeft: 'auto' }} aria-hidden="true">
            {Array.from({ length: dots.filled }).map((_, i) => (
              <div key={`f-${i}`} style={{
                width: 8, height: 8, borderRadius: '50%',
                background: 'var(--accent)',
              }} />
            ))}
            {Array.from({ length: dots.empty }).map((_, i) => (
              <div key={`e-${i}`} style={{
                width: 8, height: 8, borderRadius: '50%',
                border: '1px solid var(--bg-3)',
              }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

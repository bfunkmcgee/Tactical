import SoldierPortrait from '../SoldierPortrait';
import { useContent } from '../../content/registry';
import type { Unit, UnitId } from '../../game/types';

/**
 * Vertical icon-rail along the left edge listing every player unit
 * as a stacked pip (portrait + HP bar + AP dots). Replaces the
 * horizontal-scrolling top-strip pips that overflowed past four
 * soldiers on a 360px phone.
 *
 * Each pip is 48×56 (within the 44×44 tap-target floor on the
 * smaller axis); selected pip gets a gold border + scale-up nudge.
 */

export interface RosterRailProps {
  units: Unit[];                         // already filtered to player faction
  selectedId: UnitId | null;
  onSelect: (id: UnitId) => void;
}

function hpBarColor(hp: number, hpMax: number): string {
  const pct = hpMax > 0 ? hp / hpMax : 0;
  if (pct >= 0.66) return 'var(--success)';
  if (pct >= 0.34) return 'var(--warn)';
  return 'var(--danger)';
}

export default function RosterRail({ units, selectedId, onSelect }: RosterRailProps) {
  const pack = useContent();
  if (units.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: 'var(--s-2)',
        top: 'calc(var(--safe-top) + 72px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--s-2)',
        pointerEvents: 'auto',
        zIndex: 10,
      }}
    >
      {units.map((u) => {
        const tmpl = pack.soldierTemplates[u.templateId];
        const selected = u.id === selectedId;
        const hpPct = u.hpMax > 0 ? Math.max(0, u.hp) / u.hpMax : 0;
        return (
          <button
            key={u.id}
            onClick={() => onSelect(u.id)}
            aria-label={`${u.name} ${u.hp}/${u.hpMax} HP, ${u.ap}/${u.apMax} AP`}
            style={{
              width: 48, height: 56, padding: 2,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'flex-start',
              gap: 2,
              background: u.alive ? 'var(--bg-1)' : '#2a1a1a',
              border: `1px solid ${selected ? 'var(--accent)' : 'var(--bg-3)'}`,
              borderRadius: 'var(--r-md)',
              transform: selected ? 'scale(1.04)' : 'scale(1)',
              transition: 'transform 0.12s ease, border-color 0.12s ease',
              opacity: u.alive ? 1 : 0.4,
              backgroundImage: u.alive ? undefined :
                'linear-gradient(135deg, transparent 45%, var(--danger) 50%, transparent 55%)',
            }}
          >
            {tmpl ? (
              <SoldierPortrait template={tmpl} loadout={u.loadout} size={36} />
            ) : (
              // Fallback for templates without a registered portrait.
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: u.color, opacity: 0.7,
              }} />
            )}
            {/* HP bar */}
            <div style={{
              width: 36, height: 3, background: 'var(--bg-3)',
              borderRadius: 2, overflow: 'hidden',
            }}>
              <div style={{
                width: `${hpPct * 100}%`, height: '100%',
                background: hpBarColor(u.hp, u.hpMax),
                transition: 'width 0.18s ease',
              }} />
            </div>
            {/* AP dots */}
            <div className="row" style={{ gap: 2 }} aria-hidden="true">
              {Array.from({ length: u.apMax }).map((_, i) => (
                <div key={i} style={{
                  width: 4, height: 4, borderRadius: '50%',
                  background: i < u.ap ? 'var(--accent)' : 'var(--bg-3)',
                }} />
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}

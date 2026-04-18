import { useCombatStore } from '../state/combatStore';
import { UTILITIES } from '../game/data/utilities';
import { WEAPONS } from '../game/data/weapons';

export default function CombatHUD() {
  const phase = useCombatStore((s) => s.phase);
  const round = useCombatStore((s) => s.round);
  const units = useCombatStore((s) => s.units);
  const selectedId = useCombatStore((s) => s.selectedId);
  const mode = useCombatStore((s) => s.mode);
  const selectedUtilityIdx = useCombatStore((s) => s.selectedUtilityIdx);
  const log = useCombatStore((s) => s.log);
  const setMode = useCombatStore((s) => s.setMode);
  const tryReload = useCombatStore((s) => s.tryReload);
  const toggleOverwatch = useCombatStore((s) => s.toggleOverwatch);
  const endPlayerTurn = useCombatStore((s) => s.endPlayerTurn);
  const selectUnit = useCombatStore((s) => s.selectUnit);

  const selected = units.find((u) => u.id === selectedId);
  const playerUnits = units.filter((u) => u.faction === 'player');
  const primary = selected?.loadout ? WEAPONS[selected.loadout.primaryId] : null;

  const disabled = phase !== 'player' || !selected || !selected.alive;

  return (
    <>
      {/* Top status */}
      <div style={{ position: 'absolute', top: 'calc(var(--safe-top) + var(--s-2))', left: 'var(--s-2)', right: 'var(--s-2)', display: 'flex', gap: 'var(--s-2)', pointerEvents: 'none' }}>
        <div className="panel" style={{ padding: '6px 10px', fontSize: 13, pointerEvents: 'auto' }}>
          <strong>Round {round}</strong> · {phase === 'player' ? 'Your turn' : phase === 'enemy' ? 'Enemy turn' : phase === 'won' ? 'Victory' : 'Defeat'}
        </div>
        <div className="panel scroll-x" style={{ padding: 6, flex: 1, display: 'flex', gap: 6, pointerEvents: 'auto' }}>
          {playerUnits.map((u) => (
            <button key={u.id} onClick={() => selectUnit(u.id)}
              style={{
                minHeight: 44, minWidth: 72, padding: 6,
                border: `1px solid ${u.id === selectedId ? 'var(--accent)' : 'var(--bg-3)'}`,
                background: u.alive ? (u.id === selectedId ? 'var(--bg-3)' : 'var(--bg-2)') : '#2a1a1a',
                opacity: u.alive ? 1 : 0.5, display: 'block', textAlign: 'left',
              }}>
              <div style={{ fontSize: 11, color: u.color, fontWeight: 600 }}>{u.name}</div>
              <div style={{ fontSize: 11, color: 'var(--fg-1)' }}>{u.hp}/{u.hpMax} · AP {u.ap}/{u.apMax}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Log */}
      <div className="panel scroll-y" style={{
        position: 'absolute', right: 'var(--s-2)',
        top: 'calc(var(--safe-top) + 72px)',
        width: 220, maxHeight: 140, fontSize: 12, pointerEvents: 'auto',
        display: 'flex', flexDirection: 'column-reverse',
      }}>
        <div>
          {log.slice(-10).map((l) => (
            <div key={l.id} style={{ color: logColor(l.kind), marginBottom: 2 }}>{l.text}</div>
          ))}
        </div>
      </div>

      {/* Bottom action bar */}
      <div style={{
        position: 'absolute', bottom: 'calc(var(--safe-bottom) + var(--s-2))',
        left: 'var(--s-2)', right: 'var(--s-2)',
        display: 'flex', gap: 'var(--s-2)', flexWrap: 'wrap',
        background: 'rgba(11,15,20,0.7)', border: '1px solid var(--bg-3)', borderRadius: 'var(--r-lg)',
        padding: 'var(--s-2)', backdropFilter: 'blur(6px)',
      }}>
        <button onClick={() => setMode(mode === 'move' ? 'idle' : 'move')} disabled={disabled}
          style={{ borderColor: mode === 'move' ? 'var(--accent)' : undefined }}>Move</button>
        <button onClick={() => setMode(mode === 'fire' ? 'idle' : 'fire')}
          disabled={disabled || !primary || (selected!.ap < primary.apCost) || selected!.ammo <= 0}
          style={{ borderColor: mode === 'fire' ? 'var(--accent)' : undefined }}>
          Fire {primary ? `(${selected!.ammo}/${primary.ammo})` : ''}
        </button>
        {selected?.loadout?.utilityIds.map((uid, i) => {
          const u = UTILITIES[uid]!;
          const active = mode === 'utility' && selectedUtilityIdx === i;
          return (
            <button key={i} onClick={() => setMode(active ? 'idle' : 'utility', active ? undefined : i)}
              disabled={disabled || selected!.ap < u.apCost}
              style={{ borderColor: active ? 'var(--accent)' : undefined }}>
              {u.name}
            </button>
          );
        })}
        <button onClick={() => tryReload()} disabled={disabled || !primary || selected!.ammo >= (primary?.ammo ?? 0)}>Reload</button>
        <button onClick={() => toggleOverwatch()} disabled={disabled || selected!.ap < 1}
          style={{ borderColor: selected?.status.overwatch ? 'var(--accent)' : undefined }}>
          {selected?.status.overwatch ? 'Cancel OW' : 'Overwatch'}
        </button>
        <div style={{ flex: 1 }} />
        <button className="primary" onClick={() => endPlayerTurn()} disabled={phase !== 'player'}>End Turn</button>
      </div>
    </>
  );
}

function logColor(k: string) {
  switch (k) {
    case 'hit': return 'var(--fg-0)';
    case 'crit': return 'var(--accent-2)';
    case 'miss': return 'var(--fg-2)';
    case 'kill': return 'var(--danger)';
    case 'heal': return 'var(--success)';
    default: return 'var(--fg-1)';
  }
}

import { useState } from 'react';
import { soundEngine } from '../../game/audio/soundEngine';
import type { MissionObjective, TurnPhase, Unit } from '../../game/types';

/**
 * Top-of-screen status chip — shows round + phase + mute toggle and a
 * compact objective summary. Sits at the top-left under the safe-area
 * inset; intentionally narrow so the map dominates the screen below.
 *
 * Roster pips were moved out of the top bar in the prior HUD pass —
 * they live in <RosterRail> on the left edge now.
 */
export interface CombatTopBarProps {
  round: number;
  phase: TurnPhase;
  objective: MissionObjective;
  units: Unit[];
  defendTurns: number;
}

export default function CombatTopBar({
  round, phase, objective, units, defendTurns,
}: CombatTopBarProps) {
  // Mirror the sound engine's mute flag so React re-renders the chip
  // when it toggles. soundEngine persists the value to localStorage.
  const [muted, setMuted] = useState(() => soundEngine.isMuted());

  return (
    <div
      style={{
        position: 'fixed',
        top: 'calc(var(--safe-top) + var(--s-2))',
        left: 'var(--s-2)',
        right: 'var(--s-2)',
        display: 'flex',
        gap: 'var(--s-2)',
        pointerEvents: 'none',
        zIndex: 10,
      }}
    >
      <div className="panel stack" style={{
        padding: '6px 10px', fontSize: 13, pointerEvents: 'auto', gap: 2,
        minWidth: 0, maxWidth: '100%',
      }}>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <strong>Round {round}</strong>
          <span>· {phaseLabel(phase)}</span>
          <button
            onClick={() => { setMuted(soundEngine.toggleMute()); }}
            aria-label={muted ? 'Unmute' : 'Mute'}
            style={{
              padding: 0, minHeight: 44, minWidth: 44,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15, background: 'transparent',
              border: '1px solid var(--bg-3)',
              color: muted ? 'var(--fg-2)' : 'var(--accent)',
            }}
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
        <div style={{
          fontSize: 11, color: 'var(--fg-2)',
          textTransform: 'uppercase', letterSpacing: 0.6,
        }}>
          {objectiveLabel(objective, units, defendTurns)}
        </div>
      </div>
    </div>
  );
}

function phaseLabel(p: TurnPhase): string {
  switch (p) {
    case 'player': return 'Your turn';
    case 'enemy':  return 'Enemy turn';
    case 'won':    return 'Victory';
    case 'lost':   return 'Defeat';
  }
}

/**
 * One-line objective summary for the top-of-screen HUD chip. Includes
 * live progress for the objective kinds that have it (destructible HP,
 * rounds held, VIP health + distance to extract).
 */
export function objectiveLabel(
  o: MissionObjective,
  units: Unit[],
  defendTurns: number,
): string {
  switch (o.kind) {
    case 'eliminate_all':    return 'Objective: eliminate all hostiles';
    case 'eliminate_target': return `Objective: eliminate target`;
    case 'reach_tile':
      return o.turnLimit
        ? `Objective: reach the extraction (${o.turnLimit} rounds)`
        : 'Objective: reach the extraction';
    case 'destroy_objective': {
      const tgt = units.find((u) => u.role === 'objective'
        && u.pos.x === o.pos.x && u.pos.y === o.pos.y);
      if (!tgt || !tgt.alive) return 'Objective: target destroyed';
      return `Objective: destroy the target (${tgt.hp}/${tgt.hpMax} HP)`;
    }
    case 'defend_point':
      return `Objective: hold the point (${defendTurns}/${o.turns} rounds)`;
    case 'extract_vip': {
      const vip = units.find((u) => u.role === 'vip');
      if (!vip) return 'Objective: extract the VIP';
      if (!vip.alive) return 'Objective: VIP lost';
      const d = Math.abs(vip.pos.x - o.extractTile.x) + Math.abs(vip.pos.y - o.extractTile.y);
      return `Objective: extract VIP (HP ${vip.hp}/${vip.hpMax}, ${d} tiles to exit)`;
    }
  }
}

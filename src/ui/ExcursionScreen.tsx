import { useMemo, useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { useCampaignStore } from '../state/campaignStore';
import { useCombatStore } from '../state/combatStore';
import { useContent } from '../content/registry';
import { ALL_MAPS } from '../game/maps';
import type { Mission } from '../game/types';

/**
 * Excursion map — the missions in the active zone are rendered as plot
 * points connected by a dotted path. The player taps the current point
 * to deploy; completed points show a checkmark; locked points are dim.
 * Extraction is only offered once every point is cleared.
 */
export default function ExcursionScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const excursion = useCampaignStore((s) => s.excursion);
  const extract = useCampaignStore((s) => s.extract);
  const pack = useContent();
  const [abortConfirm, setAbortConfirm] = useState(false);

  // Compute plot-point positions once per mission-count. Deterministic
  // — same count produces the same layout across renders so the map
  // doesn't jump around between syncs.
  const positions = useMemo(
    () => missionPositions(excursion ? pack.zones?.find((z) => z.id === excursion.zoneId)?.missions.length ?? 0 : 0),
    [excursion, pack],
  );

  if (!excursion) {
    return (
      <div className="screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="panel stack" style={{ padding: 'var(--s-3)' }}>
          <p>No active excursion.</p>
          <button className="primary" onClick={() => setScreen('menu')}>Return to Base</button>
        </div>
      </div>
    );
  }
  const zone = pack.zones?.find((z) => z.id === excursion.zoneId);
  if (!zone) return null;

  function beginNextMission() {
    const mission = zone!.missions[excursion!.currentMissionIdx];
    if (!mission) return;
    const map = ALL_MAPS.find((m) => m.id === mission.mapId);
    if (!map) {
      console.warn(`[excursion] missing map '${mission.mapId}' for mission '${mission.id}'`);
      return;
    }
    const aliveSquad = excursion!.squad.filter((s) => s.alive);
    const carries: Record<string, { hp: number; ammoPrimary: number; ammoSidearm: number; utilityCharges: number[] }> = {};
    for (const s of aliveSquad) {
      carries[s.soldierId] = {
        hp: s.hp, ammoPrimary: s.ammoPrimary, ammoSidearm: s.ammoSidearm,
        utilityCharges: s.utilityCharges,
      };
    }
    useCombatStore.getState().initMission({
      map,
      rosterIds: aliveSquad.map((s) => s.soldierId),
      carries,
      briefing: `${mission.name}: ${mission.briefing}`,
    });
    setScreen('combat');
  }

  function abortExcursion() {
    extract();
    setScreen('menu');
  }

  const currentMissionIdx = excursion.currentMissionIdx;
  const allDone = excursion.extractionReady;
  const currentMission = zone.missions[currentMissionIdx];

  return (
    <div className="screen stack" style={{ padding: 'var(--s-3)', gap: 'var(--s-3)', overflow: 'hidden' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button onClick={() => setAbortConfirm(true)} style={{ opacity: .6 }}>Abort</button>
        <h2>{zone.name}</h2>
        {allDone
          ? <button className="primary" onClick={() => setScreen('excursionComplete')}>Extract</button>
          : <span style={{ width: 64 }} />}
      </div>

      <div className="scroll-y" style={{ flex: 1 }}>
        {/* Map panel — plot points + connecting path */}
        <section className="panel" style={{
          position: 'relative',
          padding: 0,
          marginBottom: 'var(--s-3)',
          overflow: 'hidden',
          aspectRatio: '3 / 2',
          // Warm dune backdrop keeps the desert feel consistent with combat tiles.
          background: 'linear-gradient(180deg, #c3a06a 0%, #a98550 60%, #8a6838 100%)',
          border: '1px solid var(--bg-3)',
        }}>
          <SandTexture />
          <MapPath positions={positions} completedIdx={excursion.completedMissionIdx} currentIdx={currentMissionIdx} />
          {zone.missions.map((m, i) => (
            <PlotPoint
              key={m.id}
              mission={m}
              index={i}
              pos={positions[i]}
              state={
                excursion.completedMissionIdx.includes(i) ? 'done' :
                i === currentMissionIdx && !allDone ? 'current' :
                'locked'
              }
              onBegin={beginNextMission}
            />
          ))}
        </section>

        {/* Briefing for current mission */}
        {currentMission && !allDone && (
          <section className="panel stack" style={{ marginBottom: 'var(--s-3)', padding: 'var(--s-3)' }}>
            <span style={{ fontSize: 11, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
              Next · objective {currentMissionIdx + 1} of {zone.missions.length}
            </span>
            <h3 style={{ margin: 0 }}>{currentMission.name}</h3>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--fg-1)' }}>{currentMission.briefing}</p>
            <button className="primary" style={{ alignSelf: 'flex-end' }}
              onClick={beginNextMission}>Deploy</button>
          </section>
        )}
        {allDone && (
          <section className="panel stack" style={{ marginBottom: 'var(--s-3)', padding: 'var(--s-3)' }}>
            <h3 style={{ margin: 0, color: 'var(--success)' }}>All objectives cleared</h3>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--fg-1)' }}>
              Extract to return the squad home and review the excursion.
            </p>
          </section>
        )}

        {/* Squad */}
        <section className="panel stack" style={{ marginBottom: 'var(--s-3)' }}>
          <h3 style={{ fontSize: 12, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: 0.6 }}>Squad</h3>
          {excursion.squad.map((s) => {
            const t = pack.soldierTemplates[s.soldierId];
            return (
              <div key={s.soldierId} className="row"
                style={{ gap: 'var(--s-3)', alignItems: 'center', opacity: s.alive ? 1 : 0.45 }}>
                <div style={{ width: 12, height: 12, background: t?.portraitColor ?? '#fff', borderRadius: 3 }} />
                <div style={{ flex: 1, fontSize: 13 }}>{t?.name ?? s.soldierId}</div>
                {s.alive
                  ? <div style={{ fontSize: 11, color: 'var(--fg-1)' }}>
                      HP {s.hp}/{t?.hpMax ?? '?'} · ammo {s.ammoPrimary}/{s.ammoSidearm}
                    </div>
                  : <div style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 600 }}>DOWN · benched</div>}
              </div>
            );
          })}
        </section>

        {/* Stockpile (display-only here; use happens at Field Camp) */}
        {Object.keys(excursion.stockpile).length > 0 && (
          <section className="panel stack">
            <h3 style={{ fontSize: 12, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
              Supplies (carried)
            </h3>
            <div className="row" style={{ flexWrap: 'wrap', gap: 'var(--s-2)' }}>
              {Object.entries(excursion.stockpile).map(([id, count]) => {
                const c = pack.consumables?.[id];
                if (!c || count <= 0) return null;
                return (
                  <div key={id} style={{
                    fontSize: 12, padding: '6px 10px', border: '1px dashed var(--bg-3)',
                    borderRadius: 'var(--r-sm)',
                  }}>
                    <strong>{c.name}</strong> × {count}
                  </div>
                );
              })}
            </div>
            <p style={{ fontSize: 11, color: 'var(--fg-2)', marginTop: 4 }}>
              Spend supplies at Field Camp between missions.
            </p>
          </section>
        )}
      </div>

      {abortConfirm && (
        <div onClick={() => setAbortConfirm(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 60,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--s-3)',
        }}>
          <div onClick={(e) => e.stopPropagation()} className="panel stack"
            style={{ maxWidth: 340, padding: 'var(--s-3)', gap: 'var(--s-3)', textAlign: 'center' }}>
            <h2 style={{ fontSize: 18 }}>Abort excursion?</h2>
            <p style={{ fontSize: 13, color: 'var(--fg-1)' }}>
              Squad retreats from the zone. Soldiers still take their wounds home,
              downed operatives go on the long bench, and <strong>no zone completion is recorded</strong>.
            </p>
            <div className="row" style={{ gap: 'var(--s-2)' }}>
              <button style={{ flex: 1 }} onClick={() => setAbortConfirm(false)}>Stay</button>
              <button className="primary" style={{ flex: 1, background: 'var(--danger)', borderColor: 'var(--danger)' }}
                onClick={abortExcursion}>Retreat</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Return a zig-zag set of plot-point positions in percent-of-container
 * coords. 1 mission sits centered; 2+ alternate across the vertical
 * middle so the connecting line reads as a physical march through the
 * zone.
 */
function missionPositions(count: number): Array<{ x: number; y: number }> {
  if (count <= 0) return [];
  if (count === 1) return [{ x: 50, y: 50 }];
  const out: Array<{ x: number; y: number }> = [];
  const leftPad = 14, rightPad = 14;
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const x = leftPad + t * (100 - leftPad - rightPad);
    // Alternate above / below the midline; end points near the middle.
    const yOffset = (i === 0 || i === count - 1) ? 0 : (i % 2 === 0 ? -18 : 18);
    out.push({ x, y: 50 + yOffset });
  }
  return out;
}

/** A subtle pass of scattered dots / dune lines behind the plot points. */
function SandTexture() {
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.35 }}
         viewBox="0 0 300 200" preserveAspectRatio="xMidYMid slice">
      <path d="M0 160 Q 60 145, 120 155 T 300 150" stroke="#7a5c30" fill="none" strokeWidth="0.6" />
      <path d="M0 130 Q 80 120, 160 128 T 300 122" stroke="#7a5c30" fill="none" strokeWidth="0.5" />
      <path d="M0 100 Q 70 90, 140 96 T 300 92" stroke="#7a5c30" fill="none" strokeWidth="0.4" />
      {[...Array(40)].map((_, i) => {
        // Deterministic specks — cheap pseudo-random from index.
        const h = (i * 2654435761) >>> 0;
        const x = (h % 300);
        const y = ((h >>> 8) % 200);
        const r = 0.4 + ((h >>> 16) % 10) / 20;
        return <circle key={i} cx={x} cy={y} r={r} fill="#6a4a22" opacity={0.7} />;
      })}
    </svg>
  );
}

/**
 * Dotted connecting path between every successive plot point. Segments
 * already walked (both endpoints completed) render solid in the success
 * colour; the segment leading into the current point animates with a
 * marching-ants stroke.
 */
function MapPath({ positions, completedIdx, currentIdx }:
  { positions: Array<{ x: number; y: number }>; completedIdx: number[]; currentIdx: number }) {
  if (positions.length < 2) return null;
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
         viewBox="0 0 100 100" preserveAspectRatio="none">
      {positions.slice(1).map((p, idx) => {
        const a = positions[idx], b = p;
        const mx = (a.x + b.x) / 2;
        const my = Math.min(a.y, b.y) - 10;
        const d = `M ${a.x} ${a.y} Q ${mx} ${my}, ${b.x} ${b.y}`;
        const endIdx = idx + 1;
        const walked = completedIdx.includes(idx) && completedIdx.includes(endIdx);
        const leading = !walked && completedIdx.includes(idx) && endIdx === currentIdx;
        const color = walked ? '#57d18b' : leading ? '#e8c488' : '#3a2814';
        const dash = walked ? 'none' : leading ? '3 2' : '1.2 1.8';
        return (
          <path key={idx}
            d={d} fill="none" stroke={color} strokeWidth="0.7"
            strokeDasharray={dash} strokeLinecap="round" vectorEffect="non-scaling-stroke">
            {leading && (
              <animate attributeName="stroke-dashoffset" from="0" to="-10" dur="1.4s" repeatCount="indefinite" />
            )}
          </path>
        );
      })}
    </svg>
  );
}

function PlotPoint({ mission, index, pos, state, onBegin }:
  { mission: Mission; index: number; pos: { x: number; y: number };
    state: 'done' | 'current' | 'locked'; onBegin: () => void }) {
  const fill = state === 'done' ? 'var(--success)' : state === 'current' ? 'var(--accent)' : 'var(--bg-3)';
  const outline = state === 'current' ? '#e8c488' : '#3a2814';
  const interactive = state === 'current';
  return (
    <button onClick={interactive ? onBegin : undefined}
      disabled={!interactive}
      aria-label={`${mission.name}${state === 'done' ? ' — complete' : state === 'current' ? ' — ready' : ' — locked'}`}
      style={{
        position: 'absolute',
        left: `${pos.x}%`, top: `${pos.y}%`,
        transform: 'translate(-50%, -50%)',
        padding: 0, border: 'none', background: 'transparent',
        cursor: interactive ? 'pointer' : 'default',
      }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: fill, border: `2px solid ${outline}`,
        boxShadow: state === 'current'
          ? '0 0 0 4px rgba(232, 196, 136, 0.35), 0 2px 6px rgba(0,0,0,0.5)'
          : '0 2px 4px rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: state === 'locked' ? 'var(--fg-2)' : '#0b0f14',
        fontSize: 14, fontWeight: 700,
        animation: state === 'current' ? 'pulse 1.6s ease-in-out infinite' : 'none',
      }}>
        {state === 'done' ? '✓' : index + 1}
      </div>
      {/* Label below the point */}
      <div style={{
        position: 'absolute', top: '100%', left: '50%',
        transform: 'translateX(-50%)', marginTop: 4,
        padding: '2px 8px',
        background: 'rgba(11, 15, 20, 0.75)', borderRadius: 4,
        fontSize: 11, color: state === 'locked' ? 'var(--fg-2)' : 'var(--fg-0)',
        whiteSpace: 'nowrap', pointerEvents: 'none',
      }}>
        {mission.name}
      </div>
    </button>
  );
}

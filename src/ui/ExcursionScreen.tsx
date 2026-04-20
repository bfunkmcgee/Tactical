import { useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { useCampaignStore } from '../state/campaignStore';
import { useCombatStore } from '../state/combatStore';
import { useContent } from '../content/registry';
import { ALL_MAPS } from '../game/maps';

/**
 * Excursion Overview. Shows the squad's carry-over state, the mission tree,
 * the consumable row (display-only for now), and the begin/extract CTA.
 */
export default function ExcursionScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const excursion = useCampaignStore((s) => s.excursion);
  const extract = useCampaignStore((s) => s.extract);
  const pack = useContent();
  const [abortConfirm, setAbortConfirm] = useState(false);

  if (!excursion) {
    // Safety net — user refreshed or state got out of sync.
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
    // Downed soldiers sit the mission out — they stay in the excursion's
    // carry list but aren't deployed onto the map.
    const aliveSquad = excursion!.squad.filter((s) => s.alive);
    const carries: Record<string, { hp: number; ammoPrimary: number; ammoSidearm: number; utilityCharges: number[] }> = {};
    for (const s of aliveSquad) {
      carries[s.soldierId] = {
        hp: s.hp,
        ammoPrimary: s.ammoPrimary,
        ammoSidearm: s.ammoSidearm,
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

  /** Abort confirmation — honest retreat. extract() applies the normal
   * wound logic per HP%. Zone progress only records completion if all
   * missions were cleared, so an aborted excursion doesn't "bank" kills. */
  function abortExcursion() {
    extract();
    setScreen('menu');
  }

  function requestExtract() {
    extract();
    useGameStore.getState().setOutcome('victory', 0, 0); // placeholder totals for phase 1
    setScreen('debrief');
  }

  const currentMissionIdx = excursion.currentMissionIdx;
  const allDone = excursion.extractionReady;

  return (
    <div className="screen stack" style={{ padding: 'var(--s-3)', gap: 'var(--s-3)', overflow: 'hidden' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button onClick={() => setAbortConfirm(true)} style={{ opacity: .6 }}>Abort</button>
        <h2>{zone.name}</h2>
        {allDone
          ? <button className="primary" onClick={requestExtract}>Extract</button>
          : <span style={{ width: 64 }} />}
      </div>

      <div className="scroll-y" style={{ flex: 1 }}>
        {/* Squad bars */}
        <section className="panel stack" style={{ marginBottom: 'var(--s-3)' }}>
          <h3 style={{ fontSize: 12, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: 0.6 }}>Squad</h3>
          {excursion.squad.map((s) => {
            const t = pack.soldierTemplates[s.soldierId];
            return (
              <div key={s.soldierId} className="row"
                style={{ gap: 'var(--s-3)', alignItems: 'center',
                         opacity: s.alive ? 1 : 0.45 }}>
                <div style={{ width: 12, height: 12, background: t?.portraitColor ?? '#fff', borderRadius: 3 }} />
                <div style={{ flex: 1, fontSize: 13 }}>{t?.name ?? s.soldierId}</div>
                {s.alive
                  ? <div style={{ fontSize: 11, color: 'var(--fg-1)' }}>
                      HP {s.hp}/{t?.hpMax ?? '?'} · ammo {s.ammoPrimary}/{s.ammoSidearm}
                    </div>
                  : <div style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 600 }}>
                      DOWN · benched
                    </div>}
              </div>
            );
          })}
        </section>

        {/* Mission list */}
        <section className="panel stack" style={{ marginBottom: 'var(--s-3)' }}>
          <h3 style={{ fontSize: 12, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: 0.6 }}>Missions</h3>
          {zone.missions.map((m, i) => {
            const done = excursion.completedMissionIdx.includes(i);
            const next = !done && i === currentMissionIdx;
            const locked = !done && !next;
            return (
              <div key={m.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                padding: 'var(--s-2)',
                opacity: locked ? 0.5 : 1,
                borderLeft: `3px solid ${done ? 'var(--success)' : next ? 'var(--accent)' : 'var(--bg-3)'}`,
                paddingLeft: 'var(--s-3)',
              }}>
                <div>
                  <strong style={{ fontSize: 13 }}>
                    {done ? '✓ ' : next ? '● ' : '○ '}{m.name}
                  </strong>
                  <div style={{ fontSize: 11, color: 'var(--fg-2)', marginTop: 2 }}>{m.briefing}</div>
                </div>
                {next && !allDone && (
                  <button className="primary" style={{ marginLeft: 'var(--s-2)' }}
                    onClick={beginNextMission}>Begin</button>
                )}
              </div>
            );
          })}
        </section>

        {/* Consumables — phase-1 display only; activation lands in phase 3 */}
        {Object.keys(excursion.stockpile).length > 0 && (
          <section className="panel stack">
            <h3 style={{ fontSize: 12, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
              Consumables (carried)
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
              Resupply use lands in phase 3.
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

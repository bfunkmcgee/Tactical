import { useGameStore } from '../state/gameStore';
import { useCampaignStore } from '../state/campaignStore';
import { useContent } from '../content/registry';
import type { ExcursionState, SquadCarry } from '../state/campaignStore';
import type { ContentPack } from '../content/types';

/**
 * Shown at the end of every excursion (victory or defeat). Presents a
 * short narrative paragraph generated from the excursion history + an
 * aggregated stats panel. "Return to base" finalises the excursion via
 * campaignStore.extract() — which applies wound penalties — then routes
 * home to the Main Menu.
 *
 * Renders against the last-known excursion snapshot (not live state):
 * the narrative + stats must survive after `extract()` clears the
 * excursion pointer, so we capture the excursion ref at mount time.
 */
export default function ExcursionCompleteScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const extract = useCampaignStore((s) => s.extract);
  const excursion = useCampaignStore((s) => s.excursion);
  const pack = useContent();

  if (!excursion) {
    return (
      <div className="screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="panel stack" style={{ padding: 'var(--s-3)' }}>
          <p>No excursion to review.</p>
          <button className="primary" onClick={() => setScreen('menu')}>Return to Base</button>
        </div>
      </div>
    );
  }
  const zone = pack.zones?.find((z) => z.id === excursion.zoneId);
  if (!zone) return null;

  const totalMissions = zone.missions.length;
  const completed = excursion.completedMissionIdx.length;
  const outcome: 'victory' | 'partial' | 'defeat' =
    completed >= totalMissions ? 'victory' :
    completed > 0 ? 'partial' : 'defeat';
  const survivors = excursion.squad.filter((s) => s.alive);
  const lost = excursion.squad.filter((s) => !s.alive);

  function returnToBase() {
    extract();          // wound roll runs here; clears `excursion`.
    setScreen('menu');
  }

  return (
    <div className="screen stack" style={{ padding: 'var(--s-3)', gap: 'var(--s-3)', overflow: 'hidden' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ width: 64 }} />
        <div className="stack" style={{ alignItems: 'center', gap: 2 }}>
          <span style={{ fontSize: 11, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
            {zone.name}
          </span>
          <h2 style={{ margin: 0 }}>
            {outcome === 'victory' ? 'Excursion Complete' :
             outcome === 'partial' ? 'Excursion Aborted' :
             'Excursion Lost'}
          </h2>
        </div>
        <button className="primary" onClick={returnToBase}>Return to Base</button>
      </div>

      <div className="scroll-y" style={{ flex: 1 }}>
        {/* Narrative */}
        <section className="panel stack" style={{ padding: 'var(--s-3)', marginBottom: 'var(--s-3)' }}>
          <h3 style={{ fontSize: 12, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: 0.6, margin: 0 }}>
            After action
          </h3>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--fg-1)' }}>
            {narrative(excursion, zone.name, outcome, survivors, lost, pack)}
          </p>
        </section>

        {/* Aggregated stats */}
        <section className="panel stack" style={{ padding: 'var(--s-3)', marginBottom: 'var(--s-3)' }}>
          <h3 style={{ fontSize: 12, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: 0.6, margin: 0 }}>
            Summary
          </h3>
          <div className="row" style={{ flexWrap: 'wrap', gap: 'var(--s-3)' }}>
            <Stat label="Missions cleared" value={`${completed} / ${totalMissions}`} />
            <Stat label="Hostiles eliminated" value={String(excursion.totalKills)} />
            <Stat label="Damage taken" value={String(excursion.totalDamageTaken)} />
            <Stat label="Survivors" value={`${survivors.length} / ${excursion.squad.length}`} />
          </div>
        </section>

        {/* Per-soldier disposition */}
        <section className="panel stack" style={{ padding: 'var(--s-3)', marginBottom: 'var(--s-3)' }}>
          <h3 style={{ fontSize: 12, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: 0.6, margin: 0 }}>
            Squad disposition
          </h3>
          {excursion.squad.map((s) => {
            const t = pack.soldierTemplates[s.soldierId];
            const status = !s.alive ? 'Down'
              : (t && s.hp / t.hpMax <= 0.3) ? 'Badly wounded'
              : (t && s.hp / t.hpMax <= 0.6) ? 'Wounded'
              : 'Ready';
            const statusColor = !s.alive ? 'var(--danger)'
              : status === 'Ready' ? 'var(--success)'
              : 'var(--accent)';
            return (
              <div key={s.soldierId} className="row"
                style={{ gap: 'var(--s-3)', alignItems: 'center', opacity: s.alive ? 1 : 0.6 }}>
                <div style={{ width: 12, height: 12, background: t?.portraitColor ?? '#fff', borderRadius: 3 }} />
                <div style={{ flex: 1, fontSize: 13 }}>{t?.name ?? s.soldierId}</div>
                <div style={{ fontSize: 11, color: 'var(--fg-1)' }}>
                  {s.alive ? `${s.hp} HP` : '—'}
                </div>
                <div style={{ fontSize: 11, color: statusColor, fontWeight: 600, minWidth: 96, textAlign: 'right' }}>
                  {status}
                </div>
              </div>
            );
          })}
        </section>

        {/* Per-mission history */}
        {excursion.history.length > 0 && (
          <section className="panel stack" style={{ padding: 'var(--s-3)' }}>
            <h3 style={{ fontSize: 12, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: 0.6, margin: 0 }}>
              Mission log
            </h3>
            {excursion.history.map((h, i) => {
              const mission = zone.missions.find((m) => m.id === h.id);
              return (
                <div key={i} className="row" style={{ gap: 'var(--s-2)', alignItems: 'center' }}>
                  <span style={{
                    fontSize: 11, color: h.outcome === 'victory' ? 'var(--success)' : 'var(--danger)',
                    fontWeight: 600, minWidth: 64,
                  }}>
                    {h.outcome === 'victory' ? '✓ Win' : '✗ Loss'}
                  </span>
                  <span style={{ fontSize: 13 }}>{mission?.name ?? h.id}</span>
                </div>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stack" style={{ gap: 2, flex: '1 1 40%', minWidth: 110 }}>
      <span style={{ fontSize: 11, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
      <span style={{ fontSize: 18, color: 'var(--fg-0)', fontWeight: 600 }}>{value}</span>
    </div>
  );
}

/**
 * Assemble a two-to-three-sentence report that references the zone, the
 * outcome arc, and the squad's fate. Deterministic — no RNG — so every
 * player reading the same run sees the same report.
 */
function narrative(
  e: ExcursionState,
  zoneName: string,
  outcome: 'victory' | 'partial' | 'defeat',
  survivors: SquadCarry[],
  lost: SquadCarry[],
  pack: ContentPack,
): string {
  const faction = pack.playerFaction.name;
  const foe = pack.enemyFaction.name;
  const missionWord = e.completedMissionIdx.length === 1 ? 'one mission' : `${e.completedMissionIdx.length} missions`;
  const killWord = e.totalKills === 1 ? 'a single hostile' : `${e.totalKills} hostiles`;

  const lead =
    outcome === 'victory'
      ? `${faction} swept the ${zoneName}, clearing ${missionWord} and dropping ${killWord} before extracting clean.`
      : outcome === 'partial'
      ? `${faction} pulled back from the ${zoneName} after ${missionWord}. ${e.totalKills} ${foe} lie where they fell, but the zone is not yet in hand.`
      : `${faction} were driven from the ${zoneName} without clearing an objective. ${foe} holds the field.`;

  let tail: string;
  if (lost.length === 0) {
    const woundedCount = survivors.filter((s) => {
      const t = pack.soldierTemplates[s.soldierId];
      return t && s.hp / t.hpMax < 0.6;
    }).length;
    tail = woundedCount === 0
      ? `Every operator walked off the dunes under their own power.`
      : `Every operator returned, though ${woundedCount} will need time on the bench.`;
  } else if (lost.length === 1) {
    const name = pack.soldierTemplates[lost[0].soldierId]?.name ?? lost[0].soldierId;
    tail = `${name} was lost to the ${zoneName}.`;
  } else {
    const names = lost
      .map((s) => pack.soldierTemplates[s.soldierId]?.name ?? s.soldierId)
      .join(', ');
    tail = `${lost.length} operators were lost: ${names}.`;
  }
  return `${lead} ${tail}`;
}

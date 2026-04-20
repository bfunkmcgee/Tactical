import { useGameStore } from '../state/gameStore';
import { useCampaignStore } from '../state/campaignStore';
import { useContent } from '../content/registry';

/**
 * Post-excursion debrief. If an excursion is still active (defeat case),
 * collapse it on return to base — phase-6 will promote survivors to
 * wounded rather than just clearing. If no excursion (legacy run), behaves
 * like the original debrief.
 */
export default function DebriefScreen() {
  const outcome = useGameStore((s) => s.lastOutcome);
  const kills = useGameStore((s) => s.lastKills);
  const dmg = useGameStore((s) => s.lastDamage);
  const setScreen = useGameStore((s) => s.setScreen);
  const excursion = useCampaignStore((s) => s.excursion);
  const extract = useCampaignStore((s) => s.extract);
  const pack = useContent();

  function returnToBase() {
    if (excursion) extract();
    setScreen('menu');
  }

  function redeploy() {
    // Legacy path: no excursion → go back to loadout and deploy a one-off mission.
    // Excursion path: extract, then show map room for a fresh deployment.
    if (excursion) {
      extract();
      setScreen('mapRoom');
    } else {
      setScreen('loadout');
    }
  }

  return (
    <div className="screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="panel stack" style={{ minWidth: 320, textAlign: 'center' }}>
        <h1 style={{ color: outcome === 'victory' ? 'var(--success)' : 'var(--danger)' }}>
          {outcome === 'victory' ? (excursion ? 'Extraction' : 'Victory') : 'Defeat'}
        </h1>
        {excursion && (
          <p style={{ fontSize: 13, color: 'var(--fg-1)', marginBottom: 4 }}>
            {pack.zones?.find((z) => z.id === excursion.zoneId)?.name ?? 'Excursion'} — {excursion.completedMissionIdx.length} mission(s) cleared.
          </p>
        )}
        <p>Kills: <strong>{kills}</strong></p>
        <p>Damage taken: <strong>{dmg}</strong></p>
        <button className="primary" onClick={redeploy}>
          {excursion ? 'Back to Map Room' : 'Redeploy'}
        </button>
        <button onClick={returnToBase}>Return to Base</button>
      </div>
    </div>
  );
}

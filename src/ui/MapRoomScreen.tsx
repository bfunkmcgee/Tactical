import { useGameStore } from '../state/gameStore';
import { useCampaignStore } from '../state/campaignStore';
import { useContent } from '../content/registry';

/**
 * Zone picker. Deploying a zone creates an excursion in the campaign store
 * and jumps to the Excursion Overview screen (which then starts mission 1).
 */
export default function MapRoomScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const startExcursion = useCampaignStore((s) => s.startExcursion);
  const completedZoneIds = useCampaignStore((s) => s.completedZoneIds);
  const pack = useContent();
  const zones = pack.zones ?? [];

  return (
    <div className="screen stack" style={{ padding: 'var(--s-3)', gap: 'var(--s-3)', overflow: 'hidden' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button onClick={() => setScreen('menu')}>Back</button>
        <h2>Map Room</h2>
        <span style={{ width: 60 }} />
      </div>

      <div className="scroll-y" style={{ flex: 1, paddingRight: 4 }}>
        <p style={{ color: 'var(--fg-2)', fontSize: 13, marginBottom: 'var(--s-3)' }}>
          Select a zone. Base stockpile is closed to you the moment boots hit the ground.
        </p>

        <div className="stack" style={{ gap: 'var(--s-2)' }}>
          {zones.map((zone) => {
            const cleared = completedZoneIds.includes(zone.id);
            return (
              <button key={zone.id}
                onClick={() => { startExcursion(zone); setScreen('excursion'); }}
                style={{
                  display: 'block', textAlign: 'left', padding: 'var(--s-3)',
                  borderColor: cleared ? 'var(--success)' : 'var(--bg-3)',
                  background: 'var(--bg-2)',
                }}>
                <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
                  <strong>{zone.name}</strong>
                  <span style={{ fontSize: 11, color: 'var(--fg-2)' }}>
                    {zone.missions.length} missions{cleared ? ' · cleared' : ''}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--fg-1)' }}>{zone.description}</div>
                <div style={{ fontSize: 11, color: 'var(--fg-2)', marginTop: 6 }}>
                  Biome: {zone.biome}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

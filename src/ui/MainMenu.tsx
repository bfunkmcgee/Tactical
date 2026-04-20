import { useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { useCampaignStore } from '../state/campaignStore';
import { useContent, setActivePack, ALL_PACKS } from '../content/registry';

/**
 * Base Camp Hub — the home screen between excursions. Rooms are flat buttons
 * that route to dedicated screens (Armoury = Loadout, Map Room = Zone picker).
 * Pack picker stays at the bottom so you can swap campaigns without coming
 * back through a menu.
 */
export default function MainMenu() {
  const setScreen = useGameStore((s) => s.setScreen);
  const resetLoadouts = useGameStore((s) => s.resetLoadouts);
  const completedZoneIds = useCampaignStore((s) => s.completedZoneIds);
  const [, bump] = useState(0);
  const pack = useContent();
  const zones = pack.zones ?? [];

  const switchTo = (id: string) => {
    const next = ALL_PACKS.find((p) => p.id === id);
    if (!next || next.id === pack.id) return;
    setActivePack(next);
    bump((n) => n + 1);
  };

  return (
    <div className="screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="panel stack" style={{ minWidth: 320, maxWidth: 420, textAlign: 'center' }}>
        <h1>Base Camp</h1>
        <h3 style={{ color: pack.playerFaction.sigilColor }}>{pack.name}</h3>
        <p style={{ margin: '8px 0 12px' }}>{pack.description}</p>

        {zones.length > 0 && (
          <div style={{ fontSize: 12, color: 'var(--fg-2)', marginBottom: 'var(--s-3)' }}>
            Zones cleared: {completedZoneIds.length} / {zones.length}
          </div>
        )}

        <div className="stack" style={{ gap: 'var(--s-2)' }}>
          <button onClick={() => setScreen('loadout')}>Armoury</button>
          {zones.length > 0
            ? <button className="primary" onClick={() => setScreen('mapRoom')}>Map Room</button>
            : <button className="primary" onClick={() => setScreen('loadout')}>New Run</button>}
          <button onClick={() => { resetLoadouts(); }} style={{ opacity: .7 }}>Reset Loadouts</button>
        </div>

        {ALL_PACKS.length > 1 && (
          <div style={{ marginTop: 'var(--s-4)', borderTop: '1px solid var(--bg-3)', paddingTop: 'var(--s-3)' }}>
            <h3 style={{ fontSize: 12, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 'var(--s-2)' }}>
              Campaign
            </h3>
            <div className="stack" style={{ gap: 'var(--s-2)' }}>
              {ALL_PACKS.map((p) => (
                <button key={p.id} onClick={() => switchTo(p.id)}
                  style={{
                    borderColor: p.id === pack.id ? 'var(--accent)' : 'var(--bg-3)',
                    background: p.id === pack.id ? 'var(--bg-3)' : 'var(--bg-2)',
                    textAlign: 'left', padding: 'var(--s-2) var(--s-3)',
                  }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: p.playerFaction.sigilColor }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--fg-2)', marginTop: 2 }}>{p.description}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

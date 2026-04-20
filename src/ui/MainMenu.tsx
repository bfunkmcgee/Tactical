import { useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { useContent, setActivePack, ALL_PACKS } from '../content/registry';

export default function MainMenu() {
  const setScreen = useGameStore((s) => s.setScreen);
  const resetLoadouts = useGameStore((s) => s.resetLoadouts);
  // Local re-render trigger when the active pack changes (since useContent()
  // returns a snapshot, not a reactive value).
  const [, bump] = useState(0);
  const pack = useContent();

  const switchTo = (id: string) => {
    const next = ALL_PACKS.find((p) => p.id === id);
    if (!next || next.id === pack.id) return;
    setActivePack(next);
    bump((n) => n + 1);
  };

  return (
    <div className="screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="panel stack" style={{ minWidth: 300, maxWidth: 380, textAlign: 'center' }}>
        <h1>Tactical</h1>
        <h3 style={{ color: pack.playerFaction.sigilColor }}>{pack.name}</h3>
        <p style={{ margin: '8px 0 16px' }}>{pack.description}</p>
        <button className="primary" onClick={() => setScreen('loadout')}>New Run</button>
        <button onClick={() => { resetLoadouts(); }}>Reset Loadouts</button>

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

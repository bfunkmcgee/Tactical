import { useGameStore } from '../state/gameStore';

export default function DebriefScreen() {
  const outcome = useGameStore((s) => s.lastOutcome);
  const kills = useGameStore((s) => s.lastKills);
  const dmg = useGameStore((s) => s.lastDamage);
  const setScreen = useGameStore((s) => s.setScreen);

  return (
    <div className="screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="panel stack" style={{ minWidth: 300, textAlign: 'center' }}>
        <h1 style={{ color: outcome === 'victory' ? 'var(--success)' : 'var(--danger)' }}>
          {outcome === 'victory' ? 'Victory' : 'Defeat'}
        </h1>
        <p>Kills: <strong>{kills}</strong></p>
        <p>Damage taken: <strong>{dmg}</strong></p>
        <button className="primary" onClick={() => setScreen('loadout')}>Redeploy</button>
        <button onClick={() => setScreen('menu')}>Main Menu</button>
      </div>
    </div>
  );
}

import { useGameStore } from '../state/gameStore';

export default function MainMenu() {
  const setScreen = useGameStore((s) => s.setScreen);
  const resetLoadouts = useGameStore((s) => s.resetLoadouts);
  return (
    <div className="screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="panel stack" style={{ minWidth: 280, maxWidth: 360, textAlign: 'center' }}>
        <h1>Tactical</h1>
        <h3>Runes &amp; Rifles</h3>
        <p style={{ margin: '8px 0 16px' }}>Fantasy-modern turn-based combat. Customize your squad, deploy into the Ruined Market.</p>
        <button className="primary" onClick={() => setScreen('loadout')}>New Run</button>
        <button onClick={() => { resetLoadouts(); }}>Reset Loadouts</button>
      </div>
    </div>
  );
}

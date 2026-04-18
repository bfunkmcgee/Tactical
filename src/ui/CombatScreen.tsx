import { useEffect } from 'react';
import { useCombatStore } from '../state/combatStore';
import { useGameStore } from '../state/gameStore';
import PixiStage from '../game/rendering/PixiStage';
import CombatHUD from './CombatHUD';

export default function CombatScreen() {
  const init = useCombatStore((s) => s.init);
  const phase = useCombatStore((s) => s.phase);
  const kills = useCombatStore((s) => s.kills);
  const damageTaken = useCombatStore((s) => s.damageTaken);
  const setOutcome = useGameStore((s) => s.setOutcome);
  const setScreen = useGameStore((s) => s.setScreen);

  useEffect(() => { init(); }, [init]);

  useEffect(() => {
    if (phase === 'won') {
      setOutcome('victory', kills, damageTaken);
      const t = setTimeout(() => setScreen('debrief'), 900);
      return () => clearTimeout(t);
    }
    if (phase === 'lost') {
      setOutcome('defeat', kills, damageTaken);
      const t = setTimeout(() => setScreen('debrief'), 900);
      return () => clearTimeout(t);
    }
  }, [phase, kills, damageTaken, setOutcome, setScreen]);

  return (
    <div className="screen" style={{ position: 'relative' }}>
      <PixiStage />
      <CombatHUD />
    </div>
  );
}

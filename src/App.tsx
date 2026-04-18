import { useGameStore } from './state/gameStore';
import MainMenu from './ui/MainMenu';
import LoadoutScreen from './ui/LoadoutScreen';
import CombatScreen from './ui/CombatScreen';
import DebriefScreen from './ui/DebriefScreen';

export default function App() {
  const screen = useGameStore((s) => s.screen);
  switch (screen) {
    case 'menu':    return <MainMenu />;
    case 'loadout': return <LoadoutScreen />;
    case 'combat':  return <CombatScreen />;
    case 'debrief': return <DebriefScreen />;
  }
}

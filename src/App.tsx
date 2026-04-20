import { useGameStore } from './state/gameStore';
import MainMenu from './ui/MainMenu';
import LoadoutScreen from './ui/LoadoutScreen';
import MapRoomScreen from './ui/MapRoomScreen';
import ExcursionScreen from './ui/ExcursionScreen';
import CombatScreen from './ui/CombatScreen';
import DebriefScreen from './ui/DebriefScreen';

export default function App() {
  const screen = useGameStore((s) => s.screen);
  switch (screen) {
    case 'menu':      return <MainMenu />;
    case 'loadout':   return <LoadoutScreen />;
    case 'mapRoom':   return <MapRoomScreen />;
    case 'excursion': return <ExcursionScreen />;
    case 'combat':    return <CombatScreen />;
    case 'debrief':   return <DebriefScreen />;
  }
}

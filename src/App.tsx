import { useGameStore } from './state/gameStore';
import MainMenu from './ui/MainMenu';
import LoadoutScreen from './ui/LoadoutScreen';
import MapRoomScreen from './ui/MapRoomScreen';
import ExcursionScreen from './ui/ExcursionScreen';
import CombatScreen from './ui/CombatScreen';
import FieldCampScreen from './ui/FieldCampScreen';
import ExcursionCompleteScreen from './ui/ExcursionCompleteScreen';
import DebriefScreen from './ui/DebriefScreen';
import CharacterAnimationPreviewer from './ui/CharacterAnimationPreviewer';

export default function App() {
  const screen = useGameStore((s) => s.screen);
  switch (screen) {
    case 'menu':              return <MainMenu />;
    case 'loadout':           return <LoadoutScreen />;
    case 'mapRoom':           return <MapRoomScreen />;
    case 'excursion':         return <ExcursionScreen />;
    case 'combat':            return <CombatScreen />;
    case 'fieldCamp':         return <FieldCampScreen />;
    case 'excursionComplete': return <ExcursionCompleteScreen />;
    case 'debrief':           return <DebriefScreen />;
    case 'previewer':         return <CharacterAnimationPreviewer />;
  }
}

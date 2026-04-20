import { useEffect } from 'react';
import { useCombatStore } from '../state/combatStore';
import { useGameStore } from '../state/gameStore';
import { useCampaignStore } from '../state/campaignStore';
import PixiStage from '../game/rendering/PixiStage';
import CombatHUD from './CombatHUD';

/**
 * Combat screen routes mission end differently depending on whether an
 * excursion is active:
 *   - Excursion + victory → snapshot squad carry, record victory, return
 *     to the Excursion Overview so the player can push next or extract.
 *   - Excursion + defeat → still snapshot, record defeat, go to debrief.
 *   - No excursion (legacy) → today's behaviour: straight to debrief.
 */
export default function CombatScreen() {
  const init = useCombatStore((s) => s.init);
  const phase = useCombatStore((s) => s.phase);
  const kills = useCombatStore((s) => s.kills);
  const damageTaken = useCombatStore((s) => s.damageTaken);
  const snapshotSquadCarry = useCombatStore((s) => s.snapshotSquadCarry);
  const setOutcome = useGameStore((s) => s.setOutcome);
  const setScreen = useGameStore((s) => s.setScreen);
  const excursion = useCampaignStore((s) => s.excursion);
  const recordVictory = useCampaignStore((s) => s.recordMissionVictory);
  const recordDefeat = useCampaignStore((s) => s.recordMissionDefeat);

  // Only call init() when we're NOT in an excursion — the excursion path
  // explicitly calls initMission() before navigating here.
  useEffect(() => {
    if (!excursion) init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase === 'won') {
      setOutcome('victory', kills, damageTaken);
      const t = setTimeout(() => {
        if (excursion) {
          // Merge the mission-end state back into the excursion carry.
          const carries = snapshotSquadCarry();
          const updatedSquad = excursion.squad.map((s) => {
            const c = carries.find((cc) => cc.soldierId === s.soldierId);
            if (!c) return s;
            return {
              ...s,
              hp: c.hp,
              ammoPrimary: c.ammoPrimary,
              ammoSidearm: c.ammoSidearm,
              utilityCharges: c.utilityCharges,
              dirt: Math.min(100, s.dirt + 15),  // phase 5 will show this
              // damage accumulates from hits in phase 5; left at 0 for now.
            };
          });
          recordVictory(updatedSquad);
          setScreen('excursion');
        } else {
          setScreen('debrief');
        }
      }, 900);
      return () => clearTimeout(t);
    }
    if (phase === 'lost') {
      setOutcome('defeat', kills, damageTaken);
      const t = setTimeout(() => {
        if (excursion) {
          recordDefeat();
          setScreen('debrief');
        } else {
          setScreen('debrief');
        }
      }, 900);
      return () => clearTimeout(t);
    }
  }, [phase, kills, damageTaken, setOutcome, setScreen, excursion,
      snapshotSquadCarry, recordVictory, recordDefeat]);

  return (
    <div className="screen" style={{ position: 'relative' }}>
      <PixiStage />
      <CombatHUD />
    </div>
  );
}

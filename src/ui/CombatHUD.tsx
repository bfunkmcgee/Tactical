import { useState } from 'react';
import { useCombatStore } from '../state/combatStore';
import { useContent } from '../content/registry';
import { soundEngine } from '../game/audio/soundEngine';
import RosterRail from './combat/RosterRail';
import MissionLog from './combat/MissionLog';
import SelectedUnitHeader from './combat/SelectedUnitHeader';
import ActionBar from './combat/ActionBar';
import ControlDeck from './combat/ControlDeck';
import CombatTopBar from './combat/CombatTopBar';
import PendingShotCard from './combat/PendingShotCard';
import PendingUtilityCard from './combat/PendingUtilityCard';
import RefitOverlay from './combat/RefitOverlay';
import { groupActions, type ActionId } from './combat/groupActions';

/**
 * Thin orchestration shell. Subscribes to the combat store, computes the
 * derived view-model (selected unit + weapons + groups + pending preview
 * data), and dispatches action ids back into the store. Each visual zone
 * — top bar, roster, log, selected-unit header, action bar, pending
 * cards, refit modal — is a focused component under `./combat/`.
 *
 * Field Refit's open-state is the only UI-only state that lives here
 * (it's a modal toggle that doesn't belong in the store).
 */
export default function CombatHUD() {
  const phase = useCombatStore((s) => s.phase);
  const round = useCombatStore((s) => s.round);
  const units = useCombatStore((s) => s.units);
  const objective = useCombatStore((s) => s.objective);
  const defendTurns = useCombatStore((s) => s.defendTurns);
  const selectedId = useCombatStore((s) => s.selectedId);
  const mode = useCombatStore((s) => s.mode);
  const selectedUtilityIdx = useCombatStore((s) => s.selectedUtilityIdx);
  const pendingShotTargetId = useCombatStore((s) => s.pendingShotTargetId);
  const pendingShotUsesSidearm = useCombatStore((s) => s.pendingShotUsesSidearm);
  const pendingUtility = useCombatStore((s) => s.pendingUtility);
  const log = useCombatStore((s) => s.log);
  const setMode = useCombatStore((s) => s.setMode);
  const tryReload = useCombatStore((s) => s.tryReload);
  const toggleOverwatch = useCombatStore((s) => s.toggleOverwatch);
  const tryRefit = useCombatStore((s) => s.tryRefit);
  const tryMysticArcaneSight = useCombatStore((s) => s.tryMysticArcaneSight);
  const endPlayerTurn = useCombatStore((s) => s.endPlayerTurn);
  const selectUnit = useCombatStore((s) => s.selectUnit);
  const confirmPending = useCombatStore((s) => s.confirmPending);
  const cancelPending = useCombatStore((s) => s.cancelPending);
  const getShotPreview = useCombatStore((s) => s.getShotPreview);

  const [refitOpen, setRefitOpen] = useState(false);

  const content = useContent();
  const selected = units.find((u) => u.id === selectedId) ?? null;
  const playerUnits = units.filter((u) => u.faction === 'player');
  const selectedTemplate = selected ? content.soldierTemplates[selected.templateId] ?? null : null;
  const selectedPrimary = selected?.loadout ? content.weapons[selected.loadout.primaryId] ?? null : null;
  const selectedSidearm = selected?.loadout ? content.weapons[selected.loadout.sidearmId] ?? null : null;

  const shotPreview = pendingShotTargetId !== null
    ? getShotPreview(pendingShotTargetId, pendingShotUsesSidearm) : null;
  const shotTarget = pendingShotTargetId !== null
    ? units.find((u) => u.id === pendingShotTargetId) ?? null : null;
  const pendingUtilityDef = (pendingUtility && selected?.loadout)
    ? content.utilities[selected.loadout.utilityIds[pendingUtility.idx]] ?? null
    : null;

  const groups = groupActions({
    unit: selected, mode, selectedUtilityIdx, phase, content,
  });

  function handleAction(id: ActionId): void {
    switch (id) {
      case 'move':    setMode(mode === 'move' ? 'idle' : 'move'); return;
      case 'fire':    setMode(mode === 'fire' ? 'idle' : 'fire'); return;
      case 'sidearm': setMode(mode === 'sidearm' ? 'idle' : 'sidearm'); return;
      case 'utility-0':
      case 'utility-1':
      case 'utility-2': {
        const idx = Number(id.slice(-1));
        const active = mode === 'utility' && selectedUtilityIdx === idx;
        setMode(active ? 'idle' : 'utility', active ? undefined : idx);
        return;
      }
      case 'reload':    tryReload(); return;
      case 'overwatch': toggleOverwatch(); return;
      case 'refit':     setRefitOpen(true); return;
      case 'classAbility': {
        // Mystic's Arcane Sight is instant; the others toggle the
        // ability targeting mode. The disabled check in groupActions
        // ensures we only get here when the action is callable.
        const tmpl = selected?.templateId ? content.soldierTemplates[selected.templateId] : null;
        if (tmpl?.class === 'Mystic') tryMysticArcaneSight();
        else setMode(mode === 'ability' ? 'idle' : 'ability');
        return;
      }
      case 'endTurn':
        soundEngine.play('ui.primary');
        endPlayerTurn();
        return;
    }
  }

  return (
    <>
      <CombatTopBar
        round={round}
        phase={phase}
        objective={objective}
        units={units}
        defendTurns={defendTurns}
      />
      <RosterRail units={playerUnits} selectedId={selectedId} onSelect={selectUnit} />
      <MissionLog entries={log} />

      {shotPreview && shotTarget && (
        <PendingShotCard
          preview={shotPreview}
          target={shotTarget}
          usesSidearm={pendingShotUsesSidearm}
          onConfirm={confirmPending}
          onCancel={cancelPending}
        />
      )}
      {pendingUtility && pendingUtilityDef && (
        <PendingUtilityCard
          utility={pendingUtilityDef}
          onConfirm={confirmPending}
          onCancel={cancelPending}
        />
      )}

      <ControlDeck
        header={selected
          ? <SelectedUnitHeader
              unit={selected}
              template={selectedTemplate}
              loadout={selected.loadout}
              primary={selectedPrimary}
              sidearm={selectedSidearm}
            />
          : null}
        bar={<ActionBar groups={groups} onAction={handleAction} />}
      />

      {refitOpen && selected && (
        <RefitOverlay
          unit={selected}
          onClose={() => setRefitOpen(false)}
          onPickMod={(slot, sidearm, modId) => tryRefit(slot, sidearm, modId)}
        />
      )}
    </>
  );
}

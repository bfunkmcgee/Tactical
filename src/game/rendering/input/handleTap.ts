import { useCombatStore } from '../../../state/combatStore';
import { useContent } from '../../../content/registry';
import type { GridMap, Vec2 } from '../../types';
import { keyOf } from '../../engine/grid';

/**
 * Route a grid-space tap into a combat-store action based on the current
 * mode. Handles the full tap → action mapping: pending preview
 * confirm/cancel, idle tap-to-select / tap-enemy-to-fire / tap-to-move,
 * fire/sidearm target picking, utility queuing, class-ability targeting.
 *
 * This is game-layer logic (not pure input), but it's small enough and
 * cohesive enough to live next to the input controller that produces
 * the grid tap. Future plan: move into a dedicated input-actions slice
 * once Enhancement D's sim/presentation split lands.
 */
export function handleTap(g: Vec2): void {
  const st = useCombatStore.getState();
  if (!inMap(st.map, g)) return;
  const unitAt = st.units.find((u) => u.alive && u.pos.x === g.x && u.pos.y === g.y);

  // Tap cancels an open pending preview (unless the same target is re-tapped to confirm).
  if (st.pendingShotTargetId !== null) {
    if (unitAt && unitAt.id === st.pendingShotTargetId) { st.confirmPending(); return; }
    st.cancelPending();
    if (st.mode !== 'fire' && st.mode !== 'sidearm') return;
  }
  if (st.pendingUtility) {
    if (st.pendingUtility.center.x === g.x && st.pendingUtility.center.y === g.y) { st.confirmPending(); return; }
    st.cancelPending();
    if (st.mode !== 'utility') return;
  }

  if (st.mode === 'idle') {
    if (unitAt && unitAt.faction === 'player') { st.selectUnit(unitAt.id); return; }
    if (unitAt && unitAt.faction === 'enemy') {
      st.setMode('fire'); st.queueShot(unitAt.id); return;
    }
    if (st.selectedId && st.reach.has(keyOf(g.x, g.y))) st.tryMove(g);
    return;
  }
  if (st.mode === 'move') {
    if (st.reach.has(keyOf(g.x, g.y))) st.tryMove(g);
    else st.setMode('idle');
    return;
  }
  if (st.mode === 'fire') {
    if (unitAt && unitAt.faction === 'enemy') st.queueShot(unitAt.id);
    else st.setMode('idle');
    return;
  }
  if (st.mode === 'sidearm') {
    if (unitAt && unitAt.faction === 'enemy') st.queueSidearmShot(unitAt.id);
    else st.setMode('idle');
    return;
  }
  if (st.mode === 'utility' && st.selectedUtilityIdx !== null) {
    st.queueUtility(g, st.selectedUtilityIdx);
    return;
  }
  if (st.mode === 'ability') {
    // Route the tap to the selected soldier's class-specific ability.
    // (The HUD button sets ability-mode only for targeting classes —
    // Mystic's Arcane Sight fires instantly from the HUD and never
    // leaves us in this mode.)
    const sel = st.units.find((u) => u.id === st.selectedId);
    if (!sel) { st.setMode('idle'); return; }
    const tmpl = useContent().soldierTemplates[sel.templateId];
    if (tmpl?.class === 'Ranger') {
      if (unitAt && unitAt.faction === 'enemy') st.tryRangerMark(unitAt.id);
      else st.setMode('idle');
      return;
    }
    if (tmpl?.class === 'Warden') {
      if (unitAt && unitAt.faction === 'enemy') st.tryWardenBracingFire(unitAt.id);
      else st.setMode('idle');
      return;
    }
    if (tmpl?.class === 'Sapper') {
      st.trySapperDemolish(g);
      return;
    }
    st.setMode('idle');
  }
}

function inMap(m: GridMap, g: Vec2): boolean {
  return g.x >= 0 && g.y >= 0 && g.x < m.width && g.y < m.height;
}

import type { Unit } from '../../game/types';
import type { ActionMode } from '../../state/combatStore';
import type { ContentPack } from '../../content/types';

/**
 * Pure descriptor + grouping helper for the tactical action bar.
 *
 * The shipping CombatHUD previously inlined every action button —
 * Move / Fire / Sidearm / utilities / Reload / Overwatch / Refit /
 * class-ability / End Turn — as a flat flex-wrap of <button> nodes
 * with their disabled / active logic computed mid-JSX. This made
 * the bar (a) untestable without React + Pixi, (b) hard to group
 * visually because the rendering loop was a single list, and (c)
 * unable to distinguish weapon names ("Fire" vs. "Fire · Carbine 7/7").
 *
 * `groupActions` is the data layer: given the active unit + mode +
 * content pack, return four named arrays of `ActionDescriptor`s.
 * `<ActionBar>` (presentational) renders them in groups separated by
 * `--bg-2` rules. Tests cover the disabled / label logic without
 * touching the DOM.
 */

export type ActionId =
  | 'move'
  | 'fire'
  | 'sidearm'
  | 'utility-0'
  | 'utility-1'
  | 'utility-2'
  | 'reload'
  | 'overwatch'
  | 'refit'
  | 'classAbility'
  | 'endTurn';

export interface ActionDescriptor {
  id: ActionId;
  label: string;
  /** Optional fallback for narrow widths (e.g. "Fire 7/7" without name). */
  shortLabel?: string;
  disabled: boolean;
  /** When `disabled` is true, a short human-readable reason
   *  ("Out of ammo", "Needs 1 AP", "Not your turn"). The bar surfaces
   *  it via the button's `title` attribute and extends the
   *  `aria-label` so screen readers announce the reason. Undefined
   *  when `disabled` is false. */
  disabledReason?: string;
  /** Mode === this action; drives the gold border on the rendered button. */
  active: boolean;
}

export interface ActionGroups {
  primary: ActionDescriptor[];   // Move / Fire / Sidearm
  utilities: ActionDescriptor[]; // utility 0..2
  class: ActionDescriptor[];     // class ability + Refit
  system: ActionDescriptor[];    // Reload / Overwatch / End Turn
}

/**
 * Helper: build a descriptor where `disabled` and `disabledReason`
 * are kept in sync via a single nullable reason. Returning `null`
 * from the reason resolver means "enabled".
 */
function mk(
  base: Omit<ActionDescriptor, 'disabled' | 'disabledReason'>,
  reason: string | null,
): ActionDescriptor {
  return reason
    ? { ...base, disabled: true, disabledReason: reason }
    : { ...base, disabled: false };
}

/**
 * Build the four-group action descriptor set for the active unit.
 *
 * Returning empty arrays when a group doesn't apply (e.g. utilities
 * when the loadout has none) lets the renderer skip the separator
 * cleanly. End Turn is ALWAYS present in `system` and stays enabled
 * while it's the player's phase, regardless of the active unit's
 * AP — players need to hand the turn over even when stuck.
 */
export function groupActions(args: {
  unit: Unit | null;
  mode: ActionMode;
  selectedUtilityIdx: number | null;
  phase: 'player' | 'enemy' | 'won' | 'lost';
  content: ContentPack;
}): ActionGroups {
  const { unit, mode, selectedUtilityIdx, phase, content } = args;
  const inPlayerPhase = phase === 'player';
  const unitPickable = inPlayerPhase && !!unit && unit.alive;

  if (!unit || !unitPickable) {
    // No selected/alive player unit: only End Turn (when in player phase)
    // is meaningful.
    return {
      primary: [],
      utilities: [],
      class: [],
      system: [
        mk({ id: 'endTurn', label: 'End Turn', active: false },
           inPlayerPhase ? null : 'Not your turn'),
      ],
    };
  }

  const loadout = unit.loadout;
  const primary = loadout ? content.weapons[loadout.primaryId] ?? null : null;
  const sidearm = loadout ? content.weapons[loadout.sidearmId] ?? null : null;
  const kit = loadout?.kitId ? content.kits[loadout.kitId] ?? null : null;
  const primaryCap = (primary?.ammo ?? 0) + (kit?.effects.extraAmmoPrimary ?? 0);
  const sidearmCap = (sidearm?.ammo ?? 0) + (kit?.effects.extraAmmoSidearm ?? 0);

  // ---- PRIMARY: Move / Fire / Sidearm
  // Reason resolvers: report the FIRST failing precondition so the
  // message is always actionable (weapon → AP → ammo).
  const moveReason = unit.ap < 1 ? 'Needs 1 AP' : null;

  const fireReason = (() => {
    if (!primary) return 'No primary weapon';
    if (unit.ap < primary.apCost) return `Needs ${primary.apCost} AP`;
    if (unit.ammo <= 0) return 'Out of ammo — reload';
    return null;
  })();

  const sidearmReason = (() => {
    if (!sidearm) return 'No sidearm';
    if (unit.ap < sidearm.apCost) return `Needs ${sidearm.apCost} AP`;
    if (unit.sidearmAmmo <= 0) return 'Out of ammo — reload';
    return null;
  })();

  const primaryGroup: ActionDescriptor[] = [
    mk({ id: 'move', label: 'Move', active: mode === 'move' }, moveReason),
    mk({
      id: 'fire',
      label: primary
        ? `Fire · ${primary.name} ${unit.ammo}/${primaryCap}`
        : 'Fire',
      shortLabel: primary ? `Fire ${unit.ammo}/${primaryCap}` : 'Fire',
      active: mode === 'fire',
    }, fireReason),
    mk({
      id: 'sidearm',
      label: sidearm
        ? `Sidearm · ${sidearm.name} ${unit.sidearmAmmo}/${sidearmCap}`
        : 'Sidearm',
      shortLabel: sidearm ? `Sidearm ${unit.sidearmAmmo}/${sidearmCap}` : 'Sidearm',
      active: mode === 'sidearm',
    }, sidearmReason),
  ];

  // ---- UTILITIES: 0..2 entries (one per loadout.utilityIds slot)
  const utilities: ActionDescriptor[] = [];
  if (loadout) {
    loadout.utilityIds.forEach((uid, i) => {
      const u = content.utilities[uid];
      if (!u) return;
      const charges = unit.utilityCharges[i] ?? 0;
      const utilityReason = (() => {
        if (unit.ap < u.apCost) return `Needs ${u.apCost} AP`;
        if (charges <= 0) return 'No charges left';
        return null;
      })();
      utilities.push(mk({
        id: (`utility-${i}` as ActionId),
        label: `${u.name} ×${charges}`,
        // Shorten via the last whitespace-split token of the name —
        // "Embercore Orb" → "Orb", "Phoenix Draught" → "Draught".
        // Good enough until per-utility short-name authoring lands.
        shortLabel: `${u.name.split(' ').pop()} ×${charges}`,
        active: mode === 'utility' && selectedUtilityIdx === i,
      }, utilityReason));
    });
  }

  // ---- CLASS: class ability + Refit
  const classGroup: ActionDescriptor[] = [];
  if (loadout) {
    const tmpl = content.soldierTemplates[unit.templateId];
    if (tmpl) {
      const inAbility = mode === 'ability';
      switch (tmpl.class) {
        case 'Ranger':
          classGroup.push(mk(
            { id: 'classAbility', label: 'Mark', active: inAbility },
            unit.ap < 1 ? 'Needs 1 AP' : null,
          ));
          break;
        case 'Warden': {
          const wardenReason = (() => {
            if (unit.ap < 1) return 'Needs 1 AP';
            if (!primary || primary.class !== 'heavy') return 'Requires heavy weapon';
            if (unit.ammo <= 0) return 'Out of ammo';
            return null;
          })();
          classGroup.push(mk(
            { id: 'classAbility', label: 'Bracing Fire', active: inAbility },
            wardenReason,
          ));
          break;
        }
        case 'Mystic': {
          const mysticReason = (() => {
            if (unit.status.seeThroughSmoke) return 'Already active';
            if (unit.ap < 1) return 'Needs 1 AP';
            return null;
          })();
          classGroup.push(mk({
            id: 'classAbility',
            label: unit.status.seeThroughSmoke ? 'Sight Active' : 'Arcane Sight',
            active: false,
          }, mysticReason));
          break;
        }
        case 'Sapper':
          classGroup.push(mk(
            { id: 'classAbility', label: 'Demolish', active: inAbility },
            unit.ap < 1 ? 'Needs 1 AP' : null,
          ));
          break;
        default:
          // No class ability for this template — skip.
          break;
      }
    }
  }
  const refitReason = (() => {
    if (unit.ap < 1) return 'Needs 1 AP';
    if (unit.status.overwatch) return 'Cancel overwatch first';
    return null;
  })();
  classGroup.push(mk(
    { id: 'refit', label: 'Refit', active: false },
    refitReason,
  ));

  // ---- SYSTEM: Reload / Overwatch / End Turn
  const reloadReason = (() => {
    if (!primary) return 'No primary weapon';
    if (unit.ammo >= primaryCap && unit.sidearmAmmo >= sidearmCap) return 'Magazines full';
    return null;
  })();
  // Reload label disambiguates which weapon would refill (when ambiguous,
  // stays plain "Reload" — the resolver in tryReload() handles both).
  const reloadLabel = (() => {
    const primaryNeedsAmmo = primary && unit.ammo < primaryCap;
    const sidearmNeedsAmmo = sidearm && unit.sidearmAmmo < sidearmCap;
    if (primaryNeedsAmmo && !sidearmNeedsAmmo && primary) return `Reload · ${primary.name}`;
    if (sidearmNeedsAmmo && !primaryNeedsAmmo && sidearm) return `Reload · ${sidearm.name}`;
    return 'Reload';
  })();

  const systemGroup: ActionDescriptor[] = [
    mk({ id: 'reload', label: reloadLabel, active: false }, reloadReason),
    mk({
      id: 'overwatch',
      label: unit.status.overwatch ? 'Cancel OW' : 'Overwatch',
      active: !!unit.status.overwatch,
    }, unit.ap < 1 ? 'Needs 1 AP' : null),
    mk(
      { id: 'endTurn', label: 'End Turn', active: false },
      inPlayerPhase ? null : 'Not your turn',
    ),
  ];

  return { primary: primaryGroup, utilities, class: classGroup, system: systemGroup };
}

/**
 * Cap the action-bar at a manageable count by overflowing tail entries
 * out of the `class` group. The first `class` slot (the soldier's
 * actual class ability) stays visible; subsequent entries (Refit + any
 * future class extras) collapse to an overflow list when total visible
 * descriptors exceed `MAX_VISIBLE`.
 *
 * Pure: returns the sliced groups + the spilled-out array. The caller
 * (`<ActionBar>`) renders the overflow as a "..." button + sheet.
 */
/**
 * Threshold at which `pickOverflow` starts collapsing tail entries
 * from `class` into the "..." sheet. Tuned for a 360px viewport
 * with short labels — 6 buttons + 4 group separators fit one row
 * comfortably; 7+ wraps. A Sapper with 2 utilities (Move/Fire/
 * Sidearm + 2 utilities + Demolish + Reload/OW/EndTurn = 9) hits
 * this threshold and pushes Refit into overflow.
 */
export const MAX_VISIBLE_ACTIONS = 6;

export function pickOverflow(groups: ActionGroups): {
  visible: ActionGroups;
  overflow: ActionDescriptor[];
} {
  const total = groups.primary.length + groups.utilities.length
    + groups.class.length + groups.system.length;
  if (total <= MAX_VISIBLE_ACTIONS) {
    return { visible: groups, overflow: [] };
  }
  const surplus = total - MAX_VISIBLE_ACTIONS;
  // Trim from the tail of `class` first (Refit is the predictable
  // non-essential entry); everything else stays.
  const keep = Math.max(1, groups.class.length - surplus);
  return {
    visible: { ...groups, class: groups.class.slice(0, keep) },
    overflow: groups.class.slice(keep),
  };
}

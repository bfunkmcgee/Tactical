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
      system: [{
        id: 'endTurn', label: 'End Turn', disabled: !inPlayerPhase, active: false,
      }],
    };
  }

  const loadout = unit.loadout;
  const primary = loadout ? content.weapons[loadout.primaryId] ?? null : null;
  const sidearm = loadout ? content.weapons[loadout.sidearmId] ?? null : null;
  const kit = loadout?.kitId ? content.kits[loadout.kitId] ?? null : null;
  const primaryCap = (primary?.ammo ?? 0) + (kit?.effects.extraAmmoPrimary ?? 0);
  const sidearmCap = (sidearm?.ammo ?? 0) + (kit?.effects.extraAmmoSidearm ?? 0);

  // ---- PRIMARY: Move / Fire / Sidearm
  const primaryGroup: ActionDescriptor[] = [
    {
      id: 'move',
      label: 'Move',
      disabled: unit.ap < 1,
      active: mode === 'move',
    },
    {
      id: 'fire',
      label: primary
        ? `Fire · ${primary.name} ${unit.ammo}/${primaryCap}`
        : 'Fire',
      shortLabel: primary ? `Fire ${unit.ammo}/${primaryCap}` : 'Fire',
      disabled: !primary || unit.ap < (primary?.apCost ?? 1) || unit.ammo <= 0,
      active: mode === 'fire',
    },
    {
      id: 'sidearm',
      label: sidearm
        ? `Sidearm · ${sidearm.name} ${unit.sidearmAmmo}/${sidearmCap}`
        : 'Sidearm',
      shortLabel: sidearm ? `Sidearm ${unit.sidearmAmmo}/${sidearmCap}` : 'Sidearm',
      disabled: !sidearm || unit.ap < (sidearm?.apCost ?? 1) || unit.sidearmAmmo <= 0,
      active: mode === 'sidearm',
    },
  ];

  // ---- UTILITIES: 0..2 entries (one per loadout.utilityIds slot)
  const utilities: ActionDescriptor[] = [];
  if (loadout) {
    loadout.utilityIds.forEach((uid, i) => {
      const u = content.utilities[uid];
      if (!u) return;
      const charges = unit.utilityCharges[i] ?? 0;
      utilities.push({
        id: (`utility-${i}` as ActionId),
        label: `${u.name} ×${charges}`,
        disabled: unit.ap < u.apCost || charges <= 0,
        active: mode === 'utility' && selectedUtilityIdx === i,
      });
    });
  }

  // ---- CLASS: class ability + Refit
  const classGroup: ActionDescriptor[] = [];
  if (loadout) {
    const tmpl = content.soldierTemplates[unit.templateId];
    if (tmpl) {
      const apOK = unit.ap >= 1;
      const inAbility = mode === 'ability';
      switch (tmpl.class) {
        case 'Ranger':
          classGroup.push({
            id: 'classAbility', label: 'Mark',
            disabled: !apOK, active: inAbility,
          });
          break;
        case 'Warden':
          classGroup.push({
            id: 'classAbility', label: 'Bracing Fire',
            disabled: !apOK || !primary || primary.class !== 'heavy' || unit.ammo <= 0,
            active: inAbility,
          });
          break;
        case 'Mystic':
          classGroup.push({
            id: 'classAbility',
            label: unit.status.seeThroughSmoke ? 'Sight Active' : 'Arcane Sight',
            disabled: !apOK || unit.status.seeThroughSmoke,
            active: false,
          });
          break;
        case 'Sapper':
          classGroup.push({
            id: 'classAbility', label: 'Demolish',
            disabled: !apOK, active: inAbility,
          });
          break;
        default:
          // No class ability for this template — skip.
          break;
      }
    }
  }
  classGroup.push({
    id: 'refit', label: 'Refit',
    disabled: unit.ap < 1 || unit.status.overwatch,
    active: false,
  });

  // ---- SYSTEM: Reload / Overwatch / End Turn
  const reloadDisabled = !primary
    || (unit.ammo >= primaryCap && unit.sidearmAmmo >= sidearmCap);
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
    { id: 'reload', label: reloadLabel, disabled: reloadDisabled, active: false },
    {
      id: 'overwatch',
      label: unit.status.overwatch ? 'Cancel OW' : 'Overwatch',
      disabled: unit.ap < 1,
      active: !!unit.status.overwatch,
    },
    { id: 'endTurn', label: 'End Turn', disabled: !inPlayerPhase, active: false },
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
export const MAX_VISIBLE_ACTIONS = 8;

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

import type {
  EnemyTemplate, Loadout, SoldierTemplate, Unit,
} from '../../game/types';

/**
 * Build a synthetic Unit from a template + optional weapon picks.
 * Used by the dev-only Animation Previewer to feed the live UnitNode
 * pipeline without going through combatStore / mission lifecycle.
 *
 * Soldier templates carry an optional loadout; we build a minimal
 * one with the picked primary + sidearm and empty mods/utilities/
 * armor/kit. Enemy templates are loadout-less and copy their attack
 * stats verbatim from the template.
 */
export function makePreviewUnit(args: {
  template: SoldierTemplate | EnemyTemplate;
  primaryId?: string | null;
  sidearmId?: string | null;
}): Unit {
  const { template, primaryId, sidearmId } = args;
  const isSoldier = 'class' in template;

  const loadout: Loadout | undefined = isSoldier
    ? {
        primaryId: primaryId ?? '',
        primaryMods: {},
        sidearmId: sidearmId ?? '',
        sidearmMods: {},
        armor: {},
        utilityIds: [],
        kitId: null,
      }
    : undefined;

  return {
    id: -1 as Unit['id'],
    faction: isSoldier ? 'player' : 'enemy',
    templateId: template.id,
    name: template.name,
    pos: { x: 0, y: 0 },
    hp: template.hpMax,
    hpMax: template.hpMax,
    aim: template.aim,
    mobility: template.mobility,
    ap: 2,
    apMax: 2,
    loadout,
    ammo: 99,
    sidearmAmmo: 99,
    utilityCharges: [],
    dmgMin: isSoldier ? 0 : (template as EnemyTemplate).dmgMin,
    dmgMax: isSoldier ? 0 : (template as EnemyTemplate).dmgMax,
    rangeShort: isSoldier ? 0 : (template as EnemyTemplate).rangeShort,
    rangeLong: isSoldier ? 0 : (template as EnemyTemplate).rangeLong,
    status: {
      overwatch: false, blinded: false, suppressed: false,
      marked: false, seeThroughSmoke: false,
    },
    alive: true,
    color: isSoldier
      ? (template as SoldierTemplate).portraitColor
      : (template as EnemyTemplate).color,
    appearance: template.appearance,
  };
}

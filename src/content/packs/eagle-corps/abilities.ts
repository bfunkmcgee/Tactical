import type { Unit } from '../../../game/types';
import type { AbilityDef } from '../../../game/engine/abilities';
import { chebyshev } from '../../../game/engine/grid';
import { WEAPONS } from './weapons';

/**
 * Eagle Corps class abilities. Each class gets one signature action that
 * ships with the pack; a new class is a pack-level addition (new soldier
 * template + one AbilityDef here) without any engine edits.
 */

const rangerMark: AbilityDef = {
  id: 'ranger-mark',
  name: 'Mark',
  classId: 'Ranger',
  apCost: 1,
  targetKind: 'enemy',
  requiresLOS: true,
  activate({ actor, target, state }) {
    const enemy = target as Unit;
    const units = state.units.map((o) =>
      o.id === enemy.id ? { ...o, status: { ...o.status, marked: true } } : o);
    return {
      units,
      logs: [`${actor.name} marks ${enemy.name} — next hit bites deeper.`],
    };
  },
};

const wardenBracingFire: AbilityDef = {
  id: 'warden-bracing-fire',
  name: 'Bracing Fire',
  classId: 'Warden',
  apCost: 1,
  ammoCost: 1,
  targetKind: 'enemy',
  requiresLOS: true,
  // Range is resolved dynamically from the warden's primary — encoded as the
  // rangeLong of whatever heavy they're carrying. `canUse` also enforces
  // that the primary is a heavy.
  canUse: (actor) => {
    if (!actor.loadout) return false;
    const primary = WEAPONS[actor.loadout.primaryId];
    return primary?.class === 'heavy';
  },
  activate({ actor, target, state }) {
    const enemy = target as Unit;
    const primary = actor.loadout ? WEAPONS[actor.loadout.primaryId] : undefined;
    if (!primary) return null;
    if (chebyshev(actor.pos, enemy.pos) > primary.rangeLong) return null;
    // Suppress target + any enemy within chebyshev-1 of them.
    const units = state.units.map((o) => {
      if (o.id === actor.id) return o; // AP/ammo/overwatch handled by store
      if (o.alive && o.faction !== actor.faction && chebyshev(o.pos, enemy.pos) <= 1) {
        return { ...o, status: { ...o.status, suppressed: true } };
      }
      return o;
    });
    return {
      units,
      logs: [`${actor.name} rakes the area with bracing fire — heads down.`],
    };
  },
};

const mysticArcaneSight: AbilityDef = {
  id: 'mystic-arcane-sight',
  name: 'Arcane Sight',
  classId: 'Mystic',
  apCost: 1,
  targetKind: 'none',
  activate({ actor, state }) {
    const units = state.units.map((o) =>
      o.id === actor.id ? { ...o, status: { ...o.status, seeThroughSmoke: true } } : o);
    return {
      units,
      logs: [`${actor.name} weaves an Arcane Sight — smoke becomes glass.`],
    };
  },
};

const sapperDemolish: AbilityDef = {
  id: 'sapper-demolish',
  name: 'Demolish',
  classId: 'Sapper',
  apCost: 1,
  targetKind: 'tile',
  range: 3,
  activate({ actor, target, state }) {
    const pos = target as { x: number; y: number };
    const idx = pos.y * state.map.width + pos.x;
    const tile = state.map.tiles[idx];
    if (!tile || (tile.kind !== 'cover_full' && tile.kind !== 'cover_half')) return null;
    const nextKind = tile.kind === 'cover_full' ? 'cover_half' : 'floor';
    const nextTiles = state.map.tiles.slice();
    nextTiles[idx] = { ...tile, kind: nextKind };
    return {
      map: { ...state.map, tiles: nextTiles },
      logs: [`${actor.name} demolishes a cover tile — ${tile.kind} → ${nextKind}.`],
    };
  },
};

export const ABILITIES: Record<string, AbilityDef> = {
  [rangerMark.id]: rangerMark,
  [wardenBracingFire.id]: wardenBracingFire,
  [mysticArcaneSight.id]: mysticArcaneSight,
  [sapperDemolish.id]: sapperDemolish,
};

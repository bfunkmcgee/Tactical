import type {
  Armor, EnemyTemplate, Kit, ModSlot, SoldierTemplate, Utility, Weapon, WeaponClass, WeaponMod,
} from '../game/types';
import type { AbilityDef } from '../game/engine/abilities';
import type { ContentPack } from './types';
import { pack as eagleCorps } from './packs/eagle-corps';
import { pack as voidWatch } from './packs/void-watch';

/** Every pack the build ships with. Add new packs here to make them selectable. */
export const ALL_PACKS: ContentPack[] = [eagleCorps, voidWatch];

/**
 * Active pack accessor. One pack is active at a time. Hot-swappable via
 * `setActivePack(pack)` — useful for dev menus or letting players pick a
 * campaign without a page reload (callers of stateful stores must reset).
 */
let active: ContentPack = eagleCorps;
const listeners = new Set<(p: ContentPack) => void>();

export const useContent = (): ContentPack => active;

export function setActivePack(p: ContentPack): void {
  active = p;
  listeners.forEach((fn) => fn(p));
}

/** Subscribe to pack swaps (returns unsubscribe). */
export function onPackChange(fn: (p: ContentPack) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// -------- Thin lookup helpers (option A: object maps + safer accessors) --------
// These wrap the raw `Record<string, T>` shape so callers don't have to deal
// with `undefined`. They throw on miss, since a missing id is always a bug.

const required = <T>(map: Record<string, T>, id: string, kind: string): T => {
  const v = map[id];
  if (!v) throw new Error(`[content] missing ${kind} id: ${id}`);
  return v;
};

export const getWeapon = (id: string): Weapon => required(active.weapons, id, 'weapon');
export const getArmor = (id: string): Armor => required(active.armor, id, 'armor');
export const getUtility = (id: string): Utility => required(active.utilities, id, 'utility');
export const getKit = (id: string): Kit => required(active.kits, id, 'kit');
export const getMod = (id: string): WeaponMod => required(active.mods, id, 'mod');
export const getSoldierTemplate = (id: string): SoldierTemplate =>
  required(active.soldierTemplates, id, 'soldier template');
export const getEnemyTemplate = (id: string): EnemyTemplate =>
  required(active.enemyTemplates, id, 'enemy template');
/** Ability lookup — returns undefined when the id is missing so the
 *  dispatcher in combatStore can cleanly return false. */
export const getAbility = (id: string): AbilityDef | undefined => active.abilities[id];
export const allAbilities = (): AbilityDef[] => Object.values(active.abilities);

export const allWeapons = (): Weapon[] => Object.values(active.weapons);
export const primaryWeapons = (): Weapon[] => allWeapons().filter((w) => w.slot === 'primary');
export const sidearms = (): Weapon[] => allWeapons().filter((w) => w.slot === 'sidearm');
export const allArmor = (): Armor[] => Object.values(active.armor);
export const allUtilities = (): Utility[] => Object.values(active.utilities);
export const allKits = (): Kit[] => Object.values(active.kits);
export const allMods = (): WeaponMod[] => Object.values(active.mods);
export const allSoldierTemplates = (): SoldierTemplate[] => Object.values(active.soldierTemplates);
export const allEnemyTemplates = (): EnemyTemplate[] => Object.values(active.enemyTemplates);

/** Mods filtered to the (slot, weaponClass) pair in the active pack. */
export const modsFor = (slot: ModSlot, weaponClass: WeaponClass): WeaponMod[] =>
  allMods().filter((m) => m.slot === slot && m.fits.includes(weaponClass));

/** Resolve a map's abstract spawn key to a concrete enemy template id. */
export const resolveSpawn = (key: string): string | undefined => active.spawnLegend[key];

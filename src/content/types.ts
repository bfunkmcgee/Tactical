import type {
  Armor, EnemyTemplate, Kit, SoldierTemplate, TileKind, Utility, Weapon, WeaponMod,
} from '../game/types';

/**
 * A self-contained "world" the engine can play. Swap the active pack and the
 * roster, items, factions, and theming all change — without touching engine
 * code. Maps are owned by the engine and packs only bind their `spawnLegend`.
 *
 * Only one pack is active at a time (see `registry.ts`).
 */
export interface ContentPack {
  id: string;
  name: string;
  description: string;

  // -------- Player content --------
  soldierTemplates: Record<string, SoldierTemplate>;
  /** Soldier ids (from soldierTemplates) deployed in order on a fresh run. */
  defaultRoster: string[];

  // -------- Enemy content --------
  enemyTemplates: Record<string, EnemyTemplate>;

  // -------- Item catalogs --------
  weapons: Record<string, Weapon>;
  armor: Record<string, Armor>;
  utilities: Record<string, Utility>;
  kits: Record<string, Kit>;
  mods: Record<string, WeaponMod>;

  /**
   * Resolves a map's abstract spawn keys to enemy template ids in this pack.
   * E.g. `{ G: 'rust_goblin', O: 'rust_orc', T: 'rust_troll' }`.
   */
  spawnLegend: Record<string, string>;

  // -------- Faction identity (for HUD copy & log lines) --------
  playerFaction: { id: string; name: string; sigilColor: string };
  enemyFaction:  { id: string; name: string; sigilColor: string };

  // -------- Optional theming --------
  theme?: PackTheme;
}

export interface PackTheme {
  /** Override tile palette per kind. Falls back to engine defaults. */
  tileColors?: Partial<Record<TileKind, number>>;
  /** Sprite path resolver: receives a unit's templateId, returns a URL. */
  spritePath?: (templateId: string) => string;
}

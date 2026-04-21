import type {
  Armor, Consumable, EnemyTemplate, Kit, SoldierTemplate, TileKind, Utility,
  Weapon, WeaponMod, Zone,
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

  // -------- Excursion loop content (optional — packs without zones fall back
  //          to the legacy pick-random-map mode, non-breaking). --------
  zones?: Zone[];
  consumables?: Record<string, Consumable>;
  /** Initial base-stockpile counts on a fresh campaign for this pack. */
  initialStockpile?: Record<string, number>;

  // -------- Optional theming --------
  theme?: PackTheme;
}

export interface PackTheme {
  /** Override tile palette per kind. Falls back to engine defaults. */
  tileColors?: Partial<Record<TileKind, number>>;
  /**
   * Body sprite path resolver. When `armsPath` is ALSO set, this should
   * point at a torso-only sprite (head + chest + legs, no arms) — arms
   * get their own independent layer. With only `spritePath` set the
   * sprite is assumed to be the full body.
   */
  spritePath?: (templateId: string) => string;
  /**
   * Optional weapon-layer resolver. When provided, the renderer layers
   * the weapon sprite on top of `spritePath` and animates it
   * independently (aim windup, recoil).
   */
  weaponPath?: (templateId: string) => string | undefined;
  /**
   * Optional arms-layer resolver. When provided alongside `weaponPath`,
   * the arms sprite is mounted inside the weapon wrap so the arms move
   * with the gun — lifting to eye level during aim, dropping on death.
   * `spritePath` should then point at the torso-only sprite.
   */
  armsPath?: (templateId: string) => string | undefined;
}

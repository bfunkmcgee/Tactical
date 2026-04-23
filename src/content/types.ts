import type {
  Armor, Clothing, Consumable, EnemyTemplate, Kit, SoldierTemplate, TileKind,
  Utility, Weapon, WeaponMod, Zone,
} from '../game/types';
import type { AbilityDef } from '../game/engine/abilities';

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
  /** Class abilities (Ranger Mark, Warden Bracing Fire, etc.). */
  abilities: Record<string, AbilityDef>;
  /** Cosmetic clothing catalog — cloaks, tabards, backpacks. Optional;
   *  packs without rig-composed characters can omit. Keyed by clothing id
   *  (referenced from Loadout.clothingIds). */
  clothing?: Record<string, Clothing>;

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

  // -------- Rig-based appearance catalogs (optional) --------
  // Consulted only when a template sets `appearance` (see HumanAppearance in
  // game/types.ts). Packs without rig-composed characters can omit both.

  /** Hair-style SVGs. Rendered centered on `joints.head` at natural scale.
   *  Keyed by style id — referenced from HumanAppearance.hairStyle. */
  hairStyles?: Record<string, { id: string; name: string; svg: string }>;

  /** Base outfits — civvies worn when no armor is equipped. Two SVGs per
   *  outfit (torso + legs) so the base silhouette can differ from any
   *  armor overlays that equip on top. Keyed by outfit id — referenced
   *  from HumanAppearance.baseOutfit. */
  baseOutfits?: Record<string, { id: string; name: string; torsoSvg: string; legsSvg: string }>;

  // -------- Optional theming --------
  theme?: PackTheme;
}

export interface PackTheme {
  /** Override tile palette per kind. Falls back to engine defaults. */
  tileColors?: Partial<Record<TileKind, number>>;
  /**
   * Template-owned weapon sprite resolver. Used for enemies whose
   * weapon sprite is bound to their template rather than to a Loadout
   * (players resolve their primary via Loadout.primaryId →
   * Weapon.spritePath instead). The returned URL is cached under
   * `${templateId}:weapon` and read at rendering time in UnitNode.
   *
   * Pre-6e this type also carried `spritePath` + `armsPath` for the
   * bespoke body/arms render path; those are gone along with that
   * code path (Phase 6e retired it — every template now ships
   * `appearance` and routes through the rig renderer).
   */
  weaponPath?: (templateId: string) => string | undefined;
}

// Shared game types. This file is the contract every other module depends on.

export type Vec2 = { x: number; y: number };

export type ElementTag = 'runic' | 'draconic' | 'alchemical' | 'fae' | 'mundane';

export type TileKind = 'floor' | 'wall' | 'cover_half' | 'cover_full' | 'hazard';

export type Tile = {
  kind: TileKind;
  /** Optional surface hint for rendering (colored palette per biome). */
  variant?: number;
};

export type GridMap = {
  id: string;
  name: string;
  width: number;
  height: number;
  /**
   * Visual biome key. The renderer maps this to a palette + detail pass
   * (sandstone bricks, dune lines, rusted refinery pipes, etc). Omit for
   * the default urban palette.
   */
  tileset?: 'urban' | 'desert' | 'desert-refinery';
  tiles: Tile[]; // row-major: tiles[y * width + x]
  playerSpawns: Vec2[];
  /**
   * Each spawn carries an abstract key (`'G'`, `'O'`, `'T'`, etc.) that is
   * resolved to a concrete enemy template id through the active ContentPack's
   * `spawnLegend`. Keeps maps engine-owned and pack-agnostic.
   */
  enemySpawns: { pos: Vec2; spawnKey: string }[];
};

export type WeaponClass = 'rifle' | 'smg' | 'shotgun' | 'sniper' | 'pistol' | 'heavy';

export type Weapon = {
  id: string;
  name: string;
  flavor: string;
  class: WeaponClass;
  slot: 'primary' | 'sidearm';
  dmgMin: number;
  dmgMax: number;
  aim: number;        // flat hit % modifier
  crit: number;       // base crit %
  rangeShort: number; // tiles; full accuracy within
  rangeLong: number;  // tiles; beyond gives penalty
  ammo: number;       // shots per magazine
  apCost: number;     // action points to fire
  endsTurn?: boolean; // e.g., snipers often end the turn if first-action
  tag: ElementTag;
  /**
   * Number of physical rounds that leave the barrel on a single fire
   * action. Each round rolls independently against the shot's hit
   * chance; per-round damage = dmgMin/burstShots..dmgMax/burstShots so
   * total burst damage tracks the listed stat. Defaults to 1 (single
   * shot) when omitted. Automatic weapons (SMG, heavy MG) set > 1.
   */
  burstShots?: number;
  /**
   * Optional URL to the weapon's SVG. When set, the renderer and the
   * armory preview both show this sprite instead of a character-
   * specific weapon — so the same weapon looks identical regardless of
   * which soldier is wielding it.
   */
  spritePath?: string;
};

export type Armor = {
  id: string;
  name: string;
  flavor: string;
  hpBonus: number;
  dr: number;         // flat damage reduction
  mobility: number;   // +/- to soldier mobility
  tag: ElementTag;
};

export type UtilityKind = 'grenade' | 'flashbang' | 'smoke' | 'medkit';

export type Utility = {
  id: string;
  name: string;
  flavor: string;
  kind: UtilityKind;
  charges: number;
  radius: number;    // tiles
  range: number;     // tiles - how far it can be thrown
  dmgMin?: number;
  dmgMax?: number;
  heal?: number;
  apCost: number;
  tag: ElementTag;
};

/**
 * Soldier class label — purely cosmetic, displayed in the loadout screen.
 * Originally a fixed union (Ranger/Warden/Mystic/Sapper) for the launch
 * faction; widened to plain string so packs can name their own classes
 * (Operator, Sentinel, Choirsworn, etc.) without the engine caring.
 */
export type SoldierClass = string;

export type ModSlot = 'optic' | 'magazine' | 'muzzle' | 'stock';

/** Sidearms only honour these two slots — keeps them simpler than primaries. */
export const SIDEARM_MOD_SLOTS: ModSlot[] = ['optic', 'muzzle'];

export type WeaponFlag =
  | 'thermal'             // weapon's LOS ignores smoke clouds
  | 'piercing'            // -2 effective armor DR
  | 'no_range_falloff'    // ignores the long-range hit penalty
  | 'recover_ammo_on_crit'; // crit refunds the spent shot

export type WeaponMod = {
  id: string;
  name: string;
  flavor: string;
  slot: ModSlot;
  fits: WeaponClass[];           // weapon classes that accept this mod
  effects: {
    aim?: number;
    crit?: number;
    dmgMin?: number;
    dmgMax?: number;
    rangeShort?: number;
    rangeLong?: number;
    ammo?: number;
    mobility?: number;           // wielder mobility delta
    flags?: WeaponFlag[];
  };
  tag: ElementTag;
};

export type Loadout = {
  primaryId: string;
  primaryMods: Partial<Record<ModSlot, string>>;
  sidearmId: string;
  sidearmMods: Partial<Record<ModSlot, string>>;
  armorId: string;
  utilityIds: string[]; // length up to 2
  kitId: string | null; // optional passive equipment
};

/**
 * Always-on passive equipment. Effects are folded into the soldier at unit
 * spawn time; no AP cost, no mid-mission interaction (yet).
 */
export type Kit = {
  id: string;
  name: string;
  flavor: string;
  effects: {
    hpBonus?: number;
    mobilityBonus?: number;
    aimBonus?: number;
    extraAmmoPrimary?: number;
    extraAmmoSidearm?: number;
    extraUtilityCharges?: number; // applied to every equipped utility
  };
  tag: ElementTag;
};

export type SoldierTemplate = {
  id: string;
  name: string;
  class: SoldierClass;
  hpMax: number;
  aim: number;      // flat hit % bonus
  mobility: number; // tiles per action point
  portraitColor: string; // MVP: flat color until sprites land
  defaultLoadout: Loadout;
};

export type EnemyTemplate = {
  id: string;
  name: string;
  hpMax: number;
  aim: number;
  mobility: number;
  dmgMin: number;
  dmgMax: number;
  rangeShort: number;
  rangeLong: number;
  kind: 'ranged' | 'melee';
  color: string;
  /**
   * Drives the renderer's fire animation (windup duration, burst vs single
   * shot, muzzle-flash size). Defaults to 'rifle' for ranged enemies when
   * omitted. Melee enemies can leave this unset.
   */
  fireClass?: WeaponClass;
  /**
   * Rounds fired per attack action. Mirrors Weapon.burstShots for enemies
   * that don't carry a player-style weapon — heavy MGs / SMGs roll each
   * round independently. Defaults to 1 when omitted.
   */
  burstShots?: number;
};

export type Faction = 'player' | 'enemy';

export type UnitId = number;

export type Unit = {
  id: UnitId;
  faction: Faction;
  templateId: string;      // soldier or enemy template id
  name: string;
  pos: Vec2;
  hp: number;
  hpMax: number;
  aim: number;
  mobility: number;
  ap: number;
  apMax: number;
  /** For player units: full loadout with resolved item objects. */
  loadout?: Loadout;
  /** Primary weapon ammo (players) / inherent attack ammo (enemies — usually infinite). */
  ammo: number;
  /** Sidearm magazine for players. Unused by enemies. */
  sidearmAmmo: number;
  /** Per-utility remaining charges, parallel to loadout.utilityIds. */
  utilityCharges: number[];
  /** Enemy innate attack stats (resolved from template at spawn); zero for players. */
  dmgMin: number;
  dmgMax: number;
  rangeShort: number;
  rangeLong: number;
  /** Runtime flags (overwatch active, stunned, etc.). */
  status: {
    overwatch: boolean;
    blinded: boolean;
    suppressed: boolean;
  };
  alive: boolean;
  color: string;
  /**
   * Grime accumulated across the current excursion (0..100). Drives a
   * dusty-brown sprite tint — cosmetic only. Cleared when the unit is
   * freshly spawned (enemies) or at the start of a new excursion
   * (players); a Field Wash consumable could also strip it later.
   */
  dirt?: number;
};

export type TurnPhase = 'player' | 'enemy' | 'won' | 'lost';

export type LogEntry = {
  id: number;
  text: string;
  kind: 'info' | 'hit' | 'miss' | 'crit' | 'kill' | 'heal';
};

export type CoverState = 'none' | 'half' | 'full';

// =========================================================================
//  Excursion loop types — see EXCURSION_LOOP.md
// =========================================================================

/** One authored step of a zone. */
export interface Mission {
  id: string;
  name: string;
  briefing: string;
  mapId: string;                        // references an engine-owned map
  objective: MissionObjective;
  /** Per-mission spawn legend tweak — overrides the pack's legend just for this mission. */
  spawnsOverride?: Record<string, string>;
  /** Gate by prior excursion history (e.g. "previous mission's id is in history"). */
  unlockCondition?: (history: readonly string[]) => boolean;
}

/**
 * Mission victory condition. The union is built up front so packs can author
 * varied missions; phase-1 engine implements only `eliminate_all` — any other
 * kind renders as "(unsupported)" in the mission list until its handler ships.
 */
export type MissionObjective =
  | { kind: 'eliminate_all' }
  | { kind: 'eliminate_target'; templateId: string }
  | { kind: 'reach_tile'; pos: Vec2; turnLimit?: number }
  | { kind: 'destroy_objective'; pos: Vec2; hp: number }
  | { kind: 'defend_point'; pos: Vec2; turns: number }
  | { kind: 'extract_vip'; vipSpawn: Vec2; extractTile: Vec2 };

/** Random encounter rolled between authored missions during an excursion. */
export interface Skirmish {
  id: string;
  name: string;
  flavor: string;
  mapId: string;
  objective: MissionObjective;
  weight: number;
  spawnsOverride?: Record<string, string>;
}

/** A deployable area — collection of missions + skirmish pool. */
export interface Zone {
  id: string;
  name: string;
  description: string;
  biome: string;
  missions: Mission[];
  skirmishes: Skirmish[];
  skirmishChance: number;              // 0..1 per inter-mission gap
  /** Resupply consumable counts granted when the player deploys into this zone. */
  consumableGrant?: Record<string, number>;
}

/** Single-use mid-excursion resupply item, consumed on the Excursion Overview. */
export interface Consumable {
  id: string;
  name: string;
  flavor: string;
  kind: 'ammo_crate' | 'med_cache' | 'armor_patch' | 'field_wash' | 'reinforcement';
  tag: ElementTag;
}

// =========================================================================

/** A single contribution to the final hit%, surfaced in the preview card. */
export type HitModifier = {
  label: string;
  value: number; // signed percentage points
};

export type ShotPreview = {
  hitChance: number;
  critChance: number;
  cover: CoverState;
  dmgMin: number;
  dmgMax: number;
  inRange: boolean;
  hasLOS: boolean;
  /** Breakdown of the hit% stack for UI display. */
  modifiers: HitModifier[];
};

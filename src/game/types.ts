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
};

export type TurnPhase = 'player' | 'enemy' | 'won' | 'lost';

export type LogEntry = {
  id: number;
  text: string;
  kind: 'info' | 'hit' | 'miss' | 'crit' | 'kill' | 'heal';
};

export type CoverState = 'none' | 'half' | 'full';

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

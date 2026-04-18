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
  enemySpawns: { pos: Vec2; enemyId: string }[];
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

export type SoldierClass = 'Ranger' | 'Warden' | 'Mystic' | 'Sapper';

export type Loadout = {
  primaryId: string;
  sidearmId: string;
  armorId: string;
  utilityIds: string[]; // length up to 2
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
  ammo: number;
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

export type ShotPreview = {
  hitChance: number;
  critChance: number;
  cover: CoverState;
  dmgMin: number;
  dmgMax: number;
  inRange: boolean;
  hasLOS: boolean;
};

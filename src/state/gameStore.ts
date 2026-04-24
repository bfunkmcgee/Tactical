import { create } from 'zustand';
import type { ArmorSlot, Loadout, SoldierTemplate } from '../game/types';
import {
  useContent, allSoldierTemplates, onPackChange, registerCustomSoldierLookup,
} from '../content/registry';
import { SKIN_TONES, HAIR_COLORS, EYE_COLORS } from '../content/rigs/palettes';

type Screen =
  | 'menu' | 'loadout' | 'mapRoom'
  | 'excursion'          // plot-point map of the excursion
  | 'combat'             // tactical layer
  | 'fieldCamp'          // between-mission resupply + heal
  | 'excursionComplete'  // narrative + aggregated stats on extract
  | 'debrief';

type SquadLoadouts = Record<string, Loadout>;
type CustomSoldiers = Record<string, SoldierTemplate>;

/** Per-pack localStorage key. `v2` (Phase 6a) carries per-slot `armor` maps;
 *  `v1` loadouts are migrated on first load (see migrateV1). */
const lsKey = (packId: string) => `tactical.${packId}.squadLoadouts.v2`;
/** Legacy v1 key — read-only; used by the v1→v2 migration at load. */
const lsKeyV1 = (packId: string) => `tactical.${packId}.squadLoadouts.v1`;
/** Separate key for custom-created soldiers (Phase 5d). Per-pack scoped
 *  the same way loadouts are. */
const lsCustomKey = (packId: string) => `tactical.${packId}.customSoldiers.v1`;

/**
 * Phase 6a decomposed monolithic Armor entries into per-slot pieces. v1
 * loadouts carry a single `armorId: 'warded_plate'`; this table maps
 * each legacy monolith id to the per-slot pieces that replaced it.
 *
 * Kept in this file (not pulled from pack content) so migration stays
 * deterministic — a pack rename downstream shouldn't silently drop
 * previously-equipped pieces. Unknown ids fall back to an empty armor
 * map (the template's defaultLoadout will repopulate on next reset).
 */
const V1_TO_V2_ARMOR: Record<string, Partial<Record<ArmorSlot, string>>> = {
  // Eagle Corps class-canonical sets.
  warded_plate: {
    chest: 'warded_plate_chest',
    gauntlets: 'warded_plate_gauntlets',
    legs: 'warded_plate_legs',
  },
  mithril_vest: {
    chest: 'mithril_vest_chest',
    gauntlets: 'mithril_vest_gauntlets',
    legs: 'mithril_vest_legs',
  },
  swiftstep_greaves: {
    chest: 'swiftstep_greaves_chest',
    gauntlets: 'swiftstep_greaves_gauntlets',
    legs: 'swiftstep_greaves_legs',
  },
  oakheart_helm: {
    chest: 'oakheart_helm_chest',
    gauntlets: 'oakheart_helm_gauntlets',
    legs: 'oakheart_helm_legs',
  },
  // Eagle Corps basic tier.
  field_harness: {
    chest: 'field_harness_chest',
    legs: 'field_harness_legs',
  },
  combat_plate: {
    helmet: 'combat_plate_helmet',
    shoulders: 'combat_plate_shoulders',
    chest: 'combat_plate_chest',
    legs: 'combat_plate_legs',
    gauntlets: 'combat_plate_gauntlets',
  },
  assault_plate: {
    helmet: 'assault_plate_helmet',
    shoulders: 'assault_plate_shoulders',
    chest: 'assault_plate_chest',
    legs: 'assault_plate_legs',
    gauntlets: 'assault_plate_gauntlets',
  },
  // Void-Watch.
  suit_lining: { chest: 'suit_lining_chest' },
  eva_plate:   { chest: 'eva_plate_chest', legs: 'eva_plate_legs' },
};

/** v1 loadout shape — pre-6a. Keep typed here so migrateV1 is explicit. */
type LoadoutV1 = Omit<Loadout, 'armor'> & { armorId?: string };

/**
 * v1 → v2 armor migration. Looks up `armorId` in V1_TO_V2_ARMOR and
 * returns the per-slot armor map. Unknown legacy ids yield `{}` — the
 * next loadout edit (or a reset) will repopulate.
 */
function migrateV1Armor(armorId: string | undefined): Partial<Record<ArmorSlot, string>> {
  if (!armorId) return {};
  return V1_TO_V2_ARMOR[armorId] ?? {};
}

/**
 * Older saved loadouts (pre-Kit / pre-mods / pre-6a) lack newer fields.
 * Normalise on load so the runtime always sees a complete Loadout shape.
 *
 * v1 `armorId` is auto-migrated to the v2 `armor` map via migrateV1Armor.
 */
function normalise(loadout: Partial<LoadoutV1> & Partial<Loadout>): Loadout {
  const armor = loadout.armor ?? migrateV1Armor(loadout.armorId);
  return {
    primaryId: loadout.primaryId!,
    primaryMods: loadout.primaryMods ?? {},
    sidearmId: loadout.sidearmId!,
    sidearmMods: loadout.sidearmMods ?? {},
    armor,
    utilityIds: loadout.utilityIds ?? [],
    kitId: loadout.kitId ?? null,
    clothingIds: loadout.clothingIds,
  };
}

function defaultsForActivePack(): SquadLoadouts {
  const out: SquadLoadouts = {};
  for (const s of allSoldierTemplates()) out[s.id] = { ...s.defaultLoadout };
  return out;
}

function loadPersisted(): SquadLoadouts {
  const packId = useContent().id;
  // 1. Try v2 first (current shape).
  try {
    const raw = localStorage.getItem(lsKey(packId));
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, Partial<Loadout>>;
      const out: SquadLoadouts = {};
      for (const id in parsed) out[id] = normalise(parsed[id]);
      return out;
    }
  } catch {}
  // 2. Fall back to v1 and migrate. Writes v2 + drops v1 on success.
  try {
    const rawV1 = localStorage.getItem(lsKeyV1(packId));
    if (rawV1) {
      const parsedV1 = JSON.parse(rawV1) as Record<string, Partial<LoadoutV1>>;
      const out: SquadLoadouts = {};
      for (const id in parsedV1) out[id] = normalise(parsedV1[id]);
      try {
        localStorage.setItem(lsKey(packId), JSON.stringify(out));
        localStorage.removeItem(lsKeyV1(packId));
      } catch {}
      return out;
    }
  } catch {}
  // 3. Nothing persisted — use pack defaults.
  return defaultsForActivePack();
}

function persist(loadouts: SquadLoadouts) {
  try { localStorage.setItem(lsKey(useContent().id), JSON.stringify(loadouts)); } catch {}
}

/**
 * Load custom soldiers for the active pack. Custom soldiers are player-
 * authored SoldierTemplates created via CharacterCreationScreen; they
 * persist per-pack the same way loadouts do. Missing key returns an
 * empty record — no throws on a fresh install.
 */
function loadCustomSoldiers(): CustomSoldiers {
  const key = lsCustomKey(useContent().id);
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as CustomSoldiers;
  } catch {}
  return {};
}

function persistCustomSoldiers(custom: CustomSoldiers) {
  try { localStorage.setItem(lsCustomKey(useContent().id), JSON.stringify(custom)); } catch {}
}

type GameState = {
  screen: Screen;
  roster: string[]; // soldier template ids (may reference customSoldiers entries)
  loadouts: SquadLoadouts;
  /**
   * Player-authored soldiers, indexed by their synthetic id (prefixed with
   * `custom_` — see composeCustomSoldier in CharacterCreationScreen.tsx).
   * `getSoldierTemplate` in content/registry.ts checks here first before
   * falling back to the active pack's catalog.
   */
  customSoldiers: CustomSoldiers;
  lastOutcome: 'victory' | 'defeat' | null;
  lastKills: number;
  lastDamage: number;

  setScreen: (s: Screen) => void;
  setLoadout: (soldierId: string, loadout: Loadout) => void;
  resetLoadouts: () => void;
  setOutcome: (o: 'victory' | 'defeat', kills: number, damage: number) => void;
  /** Replace the roster slot at the given index with the given soldier id. */
  setRosterSlot: (idx: number, soldierId: string) => void;
  /** Store a newly-created custom soldier + seed its loadout from defaults. */
  addCustomSoldier: (tpl: SoldierTemplate) => void;
  /** Remove a custom soldier (+ its loadout). No-op for pack-default ids. */
  removeCustomSoldier: (id: string) => void;
  /** Rename a custom soldier. Trims + clamps to 1–32 chars; a blank
   *  value or pack-default id is a no-op. */
  renameCustomSoldier: (id: string, name: string) => void;
  /** Randomize the custom soldier's appearance palette (skin / hair /
   *  eye / baseOutfit). Leaves name + class + loadout untouched. */
  rerollCustomSoldierAppearance: (id: string) => void;
  /** Reset roster + loadouts to the active pack's defaults. Called on pack swap. */
  reloadFromActivePack: () => void;
};

export const useGameStore = create<GameState>((set) => ({
  screen: 'menu',
  roster: useContent().defaultRoster.slice(),
  loadouts: loadPersisted(),
  customSoldiers: loadCustomSoldiers(),
  lastOutcome: null,
  lastKills: 0,
  lastDamage: 0,

  setScreen: (s) => set({ screen: s }),
  setLoadout: (soldierId, loadout) =>
    set((st) => {
      const next = { ...st.loadouts, [soldierId]: loadout };
      persist(next);
      return { loadouts: next };
    }),
  resetLoadouts: () =>
    set(() => {
      const defaults = defaultsForActivePack();
      persist(defaults);
      return { loadouts: defaults };
    }),
  setOutcome: (o, kills, damage) => set({ lastOutcome: o, lastKills: kills, lastDamage: damage }),
  setRosterSlot: (idx, soldierId) =>
    set((st) => {
      if (idx < 0 || idx >= st.roster.length) return {};
      const next = [...st.roster];
      next[idx] = soldierId;
      return { roster: next };
    }),
  addCustomSoldier: (tpl) =>
    set((st) => {
      const nextCustom = { ...st.customSoldiers, [tpl.id]: tpl };
      persistCustomSoldiers(nextCustom);
      // Seed a loadout from the template's defaults so the new soldier
      // works immediately in LoadoutScreen + deploy without a second
      // setLoadout call.
      const nextLoadouts = { ...st.loadouts, [tpl.id]: { ...tpl.defaultLoadout } };
      persist(nextLoadouts);
      return { customSoldiers: nextCustom, loadouts: nextLoadouts };
    }),
  removeCustomSoldier: (id) =>
    set((st) => {
      if (!st.customSoldiers[id]) return {};
      const nextCustom = { ...st.customSoldiers };
      delete nextCustom[id];
      persistCustomSoldiers(nextCustom);
      const nextLoadouts = { ...st.loadouts };
      delete nextLoadouts[id];
      persist(nextLoadouts);
      // If the custom soldier was in the roster, fall back to the first
      // pack-default soldier for that slot.
      const fallback = useContent().defaultRoster[0];
      const nextRoster = st.roster.map((rid) => (rid === id ? fallback : rid));
      return { customSoldiers: nextCustom, loadouts: nextLoadouts, roster: nextRoster };
    }),
  renameCustomSoldier: (id, name) =>
    set((st) => {
      const tpl = st.customSoldiers[id];
      if (!tpl) return {};
      const trimmed = name.trim().slice(0, 32);
      if (!trimmed || trimmed === tpl.name) return {};
      const nextCustom = { ...st.customSoldiers, [id]: { ...tpl, name: trimmed } };
      persistCustomSoldiers(nextCustom);
      return { customSoldiers: nextCustom };
    }),
  rerollCustomSoldierAppearance: (id) =>
    set((st) => {
      const tpl = st.customSoldiers[id];
      if (!tpl || !tpl.appearance) return {};
      const pack = useContent();
      const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
      const hairIds = pack.hairStyles ? Object.keys(pack.hairStyles) : [];
      const outfitIds = pack.baseOutfits ? Object.keys(pack.baseOutfits) : [];
      const nextAppearance = {
        ...tpl.appearance,
        skinTone: pick(SKIN_TONES).color,
        hairColor: pick(HAIR_COLORS).color,
        eyeColor: pick(EYE_COLORS).color,
        hairStyle: hairIds.length ? pick(hairIds) : tpl.appearance.hairStyle,
        baseOutfit: outfitIds.length ? pick(outfitIds) : tpl.appearance.baseOutfit,
      };
      const nextCustom = {
        ...st.customSoldiers,
        [id]: { ...tpl, appearance: nextAppearance },
      };
      persistCustomSoldiers(nextCustom);
      return { customSoldiers: nextCustom };
    }),
  reloadFromActivePack: () =>
    set(() => ({
      screen: 'menu',
      roster: useContent().defaultRoster.slice(),
      loadouts: loadPersisted(),
      customSoldiers: loadCustomSoldiers(),
      lastOutcome: null,
      lastKills: 0,
      lastDamage: 0,
    })),
}));

// Pack swaps automatically reload roster + persisted loadouts from the new pack.
onPackChange(() => {
  useGameStore.getState().reloadFromActivePack();
});

// Register the custom-soldier lookup so content/registry's
// getSoldierTemplate resolves `custom_*` ids without importing this
// store (which would create a module cycle).
registerCustomSoldierLookup((id) => useGameStore.getState().customSoldiers[id]);

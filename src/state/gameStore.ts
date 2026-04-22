import { create } from 'zustand';
import type { Loadout, SoldierTemplate } from '../game/types';
import {
  useContent, allSoldierTemplates, onPackChange, registerCustomSoldierLookup,
} from '../content/registry';

type Screen =
  | 'menu' | 'loadout' | 'mapRoom'
  | 'excursion'          // plot-point map of the excursion
  | 'combat'             // tactical layer
  | 'fieldCamp'          // between-mission resupply + heal
  | 'excursionComplete'  // narrative + aggregated stats on extract
  | 'debrief';

type SquadLoadouts = Record<string, Loadout>;
type CustomSoldiers = Record<string, SoldierTemplate>;

/** Per-pack localStorage key — keeps Eagle Corps loadouts from leaking into Void-Watch and vice versa. */
const lsKey = (packId: string) => `tactical.${packId}.squadLoadouts.v1`;
/** Separate key for custom-created soldiers (Phase 5d). Per-pack scoped
 *  the same way loadouts are. */
const lsCustomKey = (packId: string) => `tactical.${packId}.customSoldiers.v1`;

/**
 * Older saved loadouts (pre-Kit / pre-mods) lack newer fields. Normalise on
 * load so the runtime always sees a complete Loadout shape.
 */
function normalise(loadout: Partial<Loadout>): Loadout {
  return {
    primaryId: loadout.primaryId!,
    primaryMods: loadout.primaryMods ?? {},
    sidearmId: loadout.sidearmId!,
    sidearmMods: loadout.sidearmMods ?? {},
    armorId: loadout.armorId!,
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
  const key = lsKey(useContent().id);
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, Partial<Loadout>>;
      const out: SquadLoadouts = {};
      for (const id in parsed) out[id] = normalise(parsed[id]);
      return out;
    }
  } catch {}
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

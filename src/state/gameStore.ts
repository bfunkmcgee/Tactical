import { create } from 'zustand';
import type { Loadout } from '../game/types';
import { useContent, allSoldierTemplates, onPackChange } from '../content/registry';

type Screen = 'menu' | 'loadout' | 'mapRoom' | 'excursion' | 'combat' | 'debrief';

type SquadLoadouts = Record<string, Loadout>;

/** Per-pack localStorage key — keeps Eagle Corps loadouts from leaking into Void-Watch and vice versa. */
const lsKey = (packId: string) => `tactical.${packId}.squadLoadouts.v1`;

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

type GameState = {
  screen: Screen;
  roster: string[]; // soldier template ids
  loadouts: SquadLoadouts;
  lastOutcome: 'victory' | 'defeat' | null;
  lastKills: number;
  lastDamage: number;

  setScreen: (s: Screen) => void;
  setLoadout: (soldierId: string, loadout: Loadout) => void;
  resetLoadouts: () => void;
  setOutcome: (o: 'victory' | 'defeat', kills: number, damage: number) => void;
  /** Reset roster + loadouts to the active pack's defaults. Called on pack swap. */
  reloadFromActivePack: () => void;
};

export const useGameStore = create<GameState>((set) => ({
  screen: 'menu',
  roster: useContent().defaultRoster.slice(),
  loadouts: loadPersisted(),
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
  reloadFromActivePack: () =>
    set(() => ({
      screen: 'menu',
      roster: useContent().defaultRoster.slice(),
      loadouts: loadPersisted(),
      lastOutcome: null,
      lastKills: 0,
      lastDamage: 0,
    })),
}));

// Pack swaps automatically reload roster + persisted loadouts from the new pack.
onPackChange(() => {
  useGameStore.getState().reloadFromActivePack();
});

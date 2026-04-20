import { create } from 'zustand';
import type { Loadout } from '../game/types';
import { SOLDIERS } from '../game/data/soldiers';

type Screen = 'menu' | 'loadout' | 'combat' | 'debrief';

type SquadLoadouts = Record<string, Loadout>;

const LS_KEY = 'tactical.squadLoadouts.v1';

/**
 * Older saved loadouts (pre-Kit phase) lack `kitId`. Normalise on load so the
 * runtime always sees a complete Loadout shape — null kit means "no kit".
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

function loadPersisted(): SquadLoadouts {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, Partial<Loadout>>;
      const out: SquadLoadouts = {};
      for (const id in parsed) out[id] = normalise(parsed[id]);
      return out;
    }
  } catch {}
  const defaults: SquadLoadouts = {};
  for (const s of Object.values(SOLDIERS)) defaults[s.id] = { ...s.defaultLoadout };
  return defaults;
}

function persist(loadouts: SquadLoadouts) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(loadouts)); } catch {}
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
};

export const useGameStore = create<GameState>((set) => ({
  screen: 'menu',
  roster: ['ranger_kestrel', 'warden_brannock', 'mystic_seraphine', 'sapper_orin'],
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
      const defaults: SquadLoadouts = {};
      for (const s of Object.values(SOLDIERS)) defaults[s.id] = { ...s.defaultLoadout };
      persist(defaults);
      return { loadouts: defaults };
    }),
  setOutcome: (o, kills, damage) => set({ lastOutcome: o, lastKills: kills, lastDamage: damage }),
}));

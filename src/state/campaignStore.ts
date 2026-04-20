import { create } from 'zustand';
import type { Mission, Zone } from '../game/types';
import { useContent, onPackChange } from '../content/registry';

/**
 * Per-soldier state that carries across missions *inside one excursion*.
 * Reset on extraction; snapshotted after each mission's final state.
 */
export interface SquadCarry {
  soldierId: string;
  hp: number;
  ammoPrimary: number;
  ammoSidearm: number;
  utilityCharges: number[];
  dirt: number;   // 0..100 — phase 5 will render
  damage: number; // 0..100
}

export interface ExcursionState {
  zoneId: string;
  startedAt: number;
  /** Indices into zone.missions. */
  completedMissionIdx: number[];
  currentMissionIdx: number;         // which mission is up next
  squad: SquadCarry[];
  /** Consumables remaining (id → count). */
  stockpile: Record<string, number>;
  /** Completed history (id + outcome) for flavour logs. */
  history: Array<{ id: string; kind: 'mission' | 'skirmish'; outcome: 'victory' | 'defeat' }>;
  extractionReady: boolean;
}

export interface CampaignState {
  /** Soldiers available for deployment (phase 1: all from the pack). */
  rosterIds: string[];
  /** soldierId → missions remaining on the bench (phase 6 healing loop). */
  woundedIds: Record<string, number>;
  /** Base stockpile — resupply pool topped up between excursions. */
  stockpile: Record<string, number>;
  /** Zone ids the player has cleared (extracted successfully). */
  completedZoneIds: string[];
  /** Currently active excursion, or null when at base. */
  excursion: ExcursionState | null;

  // ---- actions ----
  startExcursion: (zone: Zone) => void;
  /** Record the end of the active mission and advance (or flag ready for extract). */
  recordMissionVictory: (squad: SquadCarry[]) => void;
  recordMissionDefeat: () => void;
  /** Finalise the excursion, merge survivors back to campaign, return to base. */
  extract: () => void;
  /** Reload campaign defaults from the active pack — called on pack swap. */
  reloadFromActivePack: () => void;
  /** Get the current mission, or null if no excursion / all done. */
  currentMission: () => Mission | null;
}

function freshCampaignState() {
  const pack = useContent();
  return {
    rosterIds: pack.defaultRoster.slice(),
    woundedIds: {} as Record<string, number>,
    stockpile: { ...(pack.initialStockpile ?? {}) },
    completedZoneIds: [] as string[],
    excursion: null as ExcursionState | null,
  };
}

export const useCampaignStore = create<CampaignState>((set, get) => ({
  ...freshCampaignState(),

  startExcursion: (zone) => {
    const pack = useContent();
    // Fresh squad spawning at full state. HP/ammo look up from templates+loadouts;
    // combatStore.init will handle the detail when the mission actually begins.
    const roster = get().rosterIds.filter((id) => !get().woundedIds[id]);
    const squad: SquadCarry[] = roster.map((soldierId) => ({
      soldierId,
      hp: pack.soldierTemplates[soldierId]?.hpMax ?? 10,
      ammoPrimary: 99,   // refilled at mission start from weapon + kit caps
      ammoSidearm: 99,
      utilityCharges: [],
      dirt: 0,
      damage: 0,
    }));
    const grant = zone.consumableGrant ?? {};
    const stockpile: Record<string, number> = { ...grant };
    set({
      excursion: {
        zoneId: zone.id,
        startedAt: Date.now(),
        completedMissionIdx: [],
        currentMissionIdx: 0,
        squad,
        stockpile,
        history: [],
        extractionReady: false,
      },
    });
  },

  recordMissionVictory: (squad) => {
    const e = get().excursion;
    if (!e) return;
    const zone = useContent().zones?.find((z) => z.id === e.zoneId);
    if (!zone) return;
    const completed = [...e.completedMissionIdx, e.currentMissionIdx];
    const nextIdx = e.currentMissionIdx + 1;
    const extractionReady = completed.length >= zone.missions.length;
    const historyEntry = {
      id: zone.missions[e.currentMissionIdx].id,
      kind: 'mission' as const,
      outcome: 'victory' as const,
    };
    set({
      excursion: {
        ...e,
        squad,
        completedMissionIdx: completed,
        currentMissionIdx: nextIdx,
        extractionReady,
        history: [...e.history, historyEntry],
      },
    });
  },

  recordMissionDefeat: () => {
    const e = get().excursion;
    if (!e) return;
    const zone = useContent().zones?.find((z) => z.id === e.zoneId);
    const mission = zone?.missions[e.currentMissionIdx];
    set({
      excursion: {
        ...e,
        history: mission
          ? [...e.history, { id: mission.id, kind: 'mission' as const, outcome: 'defeat' as const }]
          : e.history,
      },
    });
  },

  extract: () => {
    const e = get().excursion;
    if (!e) return;
    // Wound soldiers whose HP is low at extraction — phase-6 will render this.
    const nextWounded: Record<string, number> = { ...get().woundedIds };
    for (const s of e.squad) {
      const pack = useContent();
      const template = pack.soldierTemplates[s.soldierId];
      if (!template) continue;
      const hpPct = s.hp / template.hpMax;
      if (hpPct <= 0.3) nextWounded[s.soldierId] = 3;
      else if (hpPct <= 0.6) nextWounded[s.soldierId] = 1;
    }
    // Only record zone completion if every mission was completed.
    const zone = useContent().zones?.find((z) => z.id === e.zoneId);
    const clearedZone = zone && e.completedMissionIdx.length >= zone.missions.length;
    set({
      excursion: null,
      woundedIds: nextWounded,
      completedZoneIds: clearedZone
        ? Array.from(new Set([...get().completedZoneIds, e.zoneId]))
        : get().completedZoneIds,
    });
  },

  reloadFromActivePack: () => set(() => freshCampaignState()),

  currentMission: () => {
    const e = get().excursion;
    if (!e) return null;
    const zone = useContent().zones?.find((z) => z.id === e.zoneId);
    if (!zone) return null;
    return zone.missions[e.currentMissionIdx] ?? null;
  },
}));

// Keep campaign in sync with pack swaps.
onPackChange(() => {
  useCampaignStore.getState().reloadFromActivePack();
});

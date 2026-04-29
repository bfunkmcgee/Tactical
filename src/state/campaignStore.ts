import { create } from 'zustand';
import type { Mission, Zone } from '../game/types';
import { useContent, onPackChange } from '../content/registry';

/**
 * Per-soldier state that carries across missions *inside one excursion*.
 * Reset on extraction; snapshotted after each mission's final state.
 */
export interface SquadCarry {
  soldierId: string;
  /** False once the soldier has been downed this excursion. Sits out the rest of the deployment. */
  alive: boolean;
  hp: number;
  ammoPrimary: number;
  ammoSidearm: number;
  utilityCharges: number[];
  dirt: number;   // 0..100 — phase 5 will render
  damage: number; // 0..100
  wear?: number;  // 0..100 persistent visual attrition
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
  /** Aggregated across every mission in this excursion — rendered in
   *  the Excursion Complete screen after extraction. */
  totalKills: number;
  totalDamageTaken: number;
  /** Soldier ids who went down during this excursion (may overlap with
   *  squad entries where alive === false). */
  soldiersLost: string[];
  /**
   * Skirmish id currently in progress (between Field Camp "March on" and
   * the Combat screen detecting the win). Null when not in a skirmish.
   * Cleared when the skirmish ends or the excursion finalises.
   */
  activeSkirmishId: string | null;
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
  /** Record the end of the active mission and advance (or flag ready for extract).
   *  `kills` + `damageTaken` get added to the excursion-wide totals. */
  recordMissionVictory: (squad: SquadCarry[], kills: number, damageTaken: number) => void;
  recordMissionDefeat: (squad?: SquadCarry[], kills?: number, damageTaken?: number) => void;
  /**
   * Record a road-skirmish outcome. Unlike recordMissionVictory, this does
   * NOT advance currentMissionIdx or flag extractionReady — skirmishes are
   * detours, not objectives — but it does accumulate stats, merge squad
   * carry, and append to the history log with kind='skirmish'.
   */
  recordSkirmishVictory: (squad: SquadCarry[], kills: number, damageTaken: number, skirmishId: string) => void;
  /** Mark a skirmish as pending so CombatScreen can close it out correctly. */
  beginSkirmish: (skirmishId: string) => void;
  /** Finalise the excursion, merge survivors back to campaign, return to base. */
  extract: () => void;
  /**
   * Apply a stockpile consumable to the current squad at a Field Camp.
   *  - `ammo_crate` refills every living soldier's primary + sidearm mag.
   *  - `med_cache` restores +4 HP to every living soldier (capped by hpMax).
   * Decrements the stockpile count; no-op if stockpile has none left.
   * Returns true if the item was actually applied.
   */
  consumeItem: (id: string) => boolean;
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
      alive: true,
      hp: pack.soldierTemplates[soldierId]?.hpMax ?? 10,
      ammoPrimary: 99,   // refilled at mission start from weapon + kit caps
      ammoSidearm: 99,
      utilityCharges: [],
      dirt: 0,
      damage: 0,
      wear: 0,
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
        totalKills: 0,
        totalDamageTaken: 0,
        soldiersLost: [],
        activeSkirmishId: null,
      },
    });
  },

  /** Mark a skirmish as active; cleared by recordSkirmishVictory. */
  beginSkirmish: (skirmishId: string) => {
    const e = get().excursion;
    if (!e) return;
    set({ excursion: { ...e, activeSkirmishId: skirmishId } });
  },

  recordMissionVictory: (squad, kills, damageTaken) => {
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
    const newlyLost = squad
      .filter((s) => !s.alive && !e.soldiersLost.includes(s.soldierId))
      .map((s) => s.soldierId);
    set({
      excursion: {
        ...e,
        squad,
        completedMissionIdx: completed,
        currentMissionIdx: nextIdx,
        extractionReady,
        history: [...e.history, historyEntry],
        totalKills: e.totalKills + kills,
        totalDamageTaken: e.totalDamageTaken + damageTaken,
        soldiersLost: [...e.soldiersLost, ...newlyLost],
      },
    });
  },

  recordMissionDefeat: (squad, kills = 0, damageTaken = 0) => {
    const e = get().excursion;
    if (!e) return;
    const zone = useContent().zones?.find((z) => z.id === e.zoneId);
    const mission = zone?.missions[e.currentMissionIdx];
    const finalSquad = squad ?? e.squad;
    const newlyLost = finalSquad
      .filter((s) => !s.alive && !e.soldiersLost.includes(s.soldierId))
      .map((s) => s.soldierId);
    set({
      excursion: {
        ...e,
        squad: finalSquad,
        history: mission
          ? [...e.history, { id: mission.id, kind: 'mission' as const, outcome: 'defeat' as const }]
          : e.history,
        totalKills: e.totalKills + kills,
        totalDamageTaken: e.totalDamageTaken + damageTaken,
        soldiersLost: [...e.soldiersLost, ...newlyLost],
      },
    });
  },

  recordSkirmishVictory: (squad, kills, damageTaken, skirmishId) => {
    const e = get().excursion;
    if (!e) return;
    const newlyLost = squad
      .filter((s) => !s.alive && !e.soldiersLost.includes(s.soldierId))
      .map((s) => s.soldierId);
    set({
      excursion: {
        ...e,
        squad,
        // Skirmishes do NOT change currentMissionIdx or extractionReady.
        history: [...e.history,
          { id: skirmishId, kind: 'skirmish' as const, outcome: 'victory' as const }],
        totalKills: e.totalKills + kills,
        totalDamageTaken: e.totalDamageTaken + damageTaken,
        soldiersLost: [...e.soldiersLost, ...newlyLost],
        activeSkirmishId: null,
      },
    });
  },

  consumeItem: (id) => {
    const e = get().excursion;
    if (!e) return false;
    const count = e.stockpile[id] ?? 0;
    if (count <= 0) return false;
    const pack = useContent();
    let squad = e.squad;
    if (id === 'ammo_crate') {
      squad = e.squad.map((s) => {
        if (!s.alive) return s;
        const loadout = useContent().soldierTemplates[s.soldierId]?.defaultLoadout;
        // The "cap" the next mission will refill to is already derived from
        // weapon + kit; here we just top up to a very-high value so when
        // initMission runs it clamps to the proper cap. Using 999 is safe.
        void loadout;
        return { ...s, ammoPrimary: 999, ammoSidearm: 999 };
      });
    } else if (id === 'med_cache') {
      squad = e.squad.map((s) => {
        if (!s.alive) return s;
        const t = pack.soldierTemplates[s.soldierId];
        const hpMax = t?.hpMax ?? s.hp;
        return { ...s, hp: Math.min(hpMax, s.hp + 4) };
      });
    } else {
      // armor_patch / field_wash / reinforcement — unhandled in phase 1.
      return false;
    }
    const nextStock = { ...e.stockpile, [id]: count - 1 };
    set({ excursion: { ...e, squad, stockpile: nextStock } });
    return true;
  },

  extract: () => {
    const e = get().excursion;
    if (!e) return;
    // Wound soldiers whose HP is low at extraction — phase-6 will render this.
    // Downed (`!alive`) soldiers always take the max-wound penalty regardless of HP.
    const nextWounded: Record<string, number> = { ...get().woundedIds };
    for (const s of e.squad) {
      const pack = useContent();
      const template = pack.soldierTemplates[s.soldierId];
      if (!template) continue;
      if (!s.alive) { nextWounded[s.soldierId] = 3; continue; }
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

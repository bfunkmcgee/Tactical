import { describe, it, expect, beforeEach } from 'vitest';
import { useCampaignStore, type SquadCarry } from './campaignStore';
import { useContent } from '../content/registry';
import type { Zone } from '../game/types';

/**
 * Covers the excursion state-machine: start, mission wins / losses,
 * skirmish detours, extract() wound-roll math, and consumable effects.
 *
 * Heavy numeric tests (HP thresholds, dedup) exist because the
 * campaign store's behaviour is invisible until the player looks at
 * post-extract wound counts — silent bugs here can persist for days.
 */

function activeZone(): Zone {
  const pack = useContent();
  const z = pack.zones?.[0];
  if (!z) throw new Error('active pack has no zones');
  return z;
}

/**
 * Hand-craft a SquadCarry using the template's hpMax so test assertions
 * aren't fragile against rebalancing. Fill in only the fields the test
 * cares about; everything else defaults to "uninjured".
 */
function mkCarry(soldierId: string, over: Partial<SquadCarry> = {}): SquadCarry {
  const pack = useContent();
  const hpMax = pack.soldierTemplates[soldierId]?.hpMax ?? 10;
  return {
    soldierId,
    alive: true,
    hp: hpMax,
    ammoPrimary: 99,
    ammoSidearm: 99,
    utilityCharges: [],
    dirt: 0,
    damage: 0,
    ...over,
  };
}

function resetCampaign() {
  useCampaignStore.getState().reloadFromActivePack();
}

describe('campaignStore: startExcursion', () => {
  beforeEach(resetCampaign);

  it('spawns the full (non-wounded) roster at full HP and grants consumables', () => {
    const zone = activeZone();
    useCampaignStore.getState().startExcursion(zone);
    const e = useCampaignStore.getState().excursion!;
    expect(e).not.toBeNull();
    expect(e.zoneId).toBe(zone.id);
    expect(e.currentMissionIdx).toBe(0);
    expect(e.completedMissionIdx).toEqual([]);
    expect(e.extractionReady).toBe(false);
    expect(e.totalKills).toBe(0);
    expect(e.totalDamageTaken).toBe(0);
    expect(e.soldiersLost).toEqual([]);
    expect(e.activeSkirmishId).toBeNull();
    // Each soldier spawns alive at template hpMax.
    for (const s of e.squad) {
      const t = useContent().soldierTemplates[s.soldierId]!;
      expect(s.alive).toBe(true);
      expect(s.hp).toBe(t.hpMax);
      expect(s.dirt).toBe(0);
    }
    // Zone consumableGrant copied into stockpile.
    for (const id in zone.consumableGrant ?? {}) {
      expect(e.stockpile[id]).toBe(zone.consumableGrant![id]);
    }
  });

  it('excludes wounded soldiers from the deployment roster', () => {
    const zone = activeZone();
    const roster = useCampaignStore.getState().rosterIds;
    // Bench the first soldier — startExcursion should skip them.
    useCampaignStore.setState({ woundedIds: { [roster[0]]: 2 } });
    useCampaignStore.getState().startExcursion(zone);
    const e = useCampaignStore.getState().excursion!;
    expect(e.squad.map((s) => s.soldierId)).not.toContain(roster[0]);
    expect(e.squad.length).toBe(roster.length - 1);
  });
});

describe('campaignStore: recordMissionVictory', () => {
  beforeEach(() => { resetCampaign(); useCampaignStore.getState().startExcursion(activeZone()); });

  it('advances the current mission index and logs victory in history', () => {
    const before = useCampaignStore.getState().excursion!;
    const squad = before.squad.map((s) => mkCarry(s.soldierId));
    useCampaignStore.getState().recordMissionVictory(squad, 3, 7);
    const e = useCampaignStore.getState().excursion!;
    expect(e.currentMissionIdx).toBe(1);
    expect(e.completedMissionIdx).toEqual([0]);
    expect(e.totalKills).toBe(3);
    expect(e.totalDamageTaken).toBe(7);
    expect(e.history.length).toBe(1);
    expect(e.history[0]).toMatchObject({ kind: 'mission', outcome: 'victory' });
  });

  it('flags extractionReady once every mission is completed', () => {
    const zone = activeZone();
    const squad = useCampaignStore.getState().excursion!.squad;
    for (let i = 0; i < zone.missions.length; i++) {
      useCampaignStore.getState().recordMissionVictory(squad, 0, 0);
    }
    expect(useCampaignStore.getState().excursion!.extractionReady).toBe(true);
  });

  it('de-duplicates soldiersLost when the same soldier is still dead next mission', () => {
    const squadBefore = useCampaignStore.getState().excursion!.squad;
    // Mark the first soldier as down.
    const downed = mkCarry(squadBefore[0].soldierId, { alive: false, hp: 0 });
    const others = squadBefore.slice(1).map((s) => mkCarry(s.soldierId));
    useCampaignStore.getState().recordMissionVictory([downed, ...others], 0, 0);
    expect(useCampaignStore.getState().excursion!.soldiersLost).toEqual([downed.soldierId]);
    // Re-record victory with the same soldier still downed. Must not duplicate.
    useCampaignStore.getState().recordMissionVictory([downed, ...others], 0, 0);
    expect(useCampaignStore.getState().excursion!.soldiersLost).toEqual([downed.soldierId]);
  });

  it('accumulates kills + damageTaken across multiple missions', () => {
    const squad = useCampaignStore.getState().excursion!.squad.map((s) => mkCarry(s.soldierId));
    useCampaignStore.getState().recordMissionVictory(squad, 4, 10);
    useCampaignStore.getState().recordMissionVictory(squad, 2, 5);
    const e = useCampaignStore.getState().excursion!;
    expect(e.totalKills).toBe(6);
    expect(e.totalDamageTaken).toBe(15);
  });
});

describe('campaignStore: recordSkirmishVictory', () => {
  beforeEach(() => { resetCampaign(); useCampaignStore.getState().startExcursion(activeZone()); });

  it('does NOT advance currentMissionIdx or flag extractionReady', () => {
    const before = useCampaignStore.getState().excursion!;
    const squad = before.squad.map((s) => mkCarry(s.soldierId));
    useCampaignStore.getState().beginSkirmish('raider-ambush');
    useCampaignStore.getState().recordSkirmishVictory(squad, 2, 4, 'raider-ambush');
    const e = useCampaignStore.getState().excursion!;
    expect(e.currentMissionIdx).toBe(before.currentMissionIdx);
    expect(e.completedMissionIdx).toEqual(before.completedMissionIdx);
    expect(e.extractionReady).toBe(false);
  });

  it('clears activeSkirmishId after recording', () => {
    const squad = useCampaignStore.getState().excursion!.squad.map((s) => mkCarry(s.soldierId));
    useCampaignStore.getState().beginSkirmish('raider-ambush');
    expect(useCampaignStore.getState().excursion!.activeSkirmishId).toBe('raider-ambush');
    useCampaignStore.getState().recordSkirmishVictory(squad, 1, 1, 'raider-ambush');
    expect(useCampaignStore.getState().excursion!.activeSkirmishId).toBeNull();
  });

  it('appends to history with kind=skirmish and accumulates stats', () => {
    const before = useCampaignStore.getState().excursion!;
    const squad = before.squad.map((s) => mkCarry(s.soldierId));
    useCampaignStore.getState().recordSkirmishVictory(squad, 2, 3, 'raider-ambush');
    const e = useCampaignStore.getState().excursion!;
    expect(e.history.length).toBe(before.history.length + 1);
    expect(e.history.at(-1)).toMatchObject({
      id: 'raider-ambush', kind: 'skirmish', outcome: 'victory',
    });
    expect(e.totalKills).toBe(2);
    expect(e.totalDamageTaken).toBe(3);
  });
});

describe('campaignStore: extract() wound roll', () => {
  beforeEach(() => { resetCampaign(); useCampaignStore.getState().startExcursion(activeZone()); });

  it('marks soldiers <= 30% HP as 3-mission wounds', () => {
    const squad = useCampaignStore.getState().excursion!.squad;
    const t = useContent().soldierTemplates[squad[0].soldierId]!;
    // 30% of hpMax (rounded down).
    const lowHp = Math.floor(t.hpMax * 0.3);
    useCampaignStore.setState({
      excursion: {
        ...useCampaignStore.getState().excursion!,
        squad: [
          { ...squad[0], hp: lowHp, alive: true },
          ...squad.slice(1).map((s) => ({ ...s, hp: useContent().soldierTemplates[s.soldierId]!.hpMax })),
        ],
      },
    });
    useCampaignStore.getState().extract();
    expect(useCampaignStore.getState().woundedIds[squad[0].soldierId]).toBe(3);
  });

  it('marks soldiers between 30% and 60% HP as 1-mission wounds', () => {
    const squad = useCampaignStore.getState().excursion!.squad;
    const t = useContent().soldierTemplates[squad[0].soldierId]!;
    // 50% HP lands cleanly between the two thresholds.
    const midHp = Math.floor(t.hpMax * 0.5);
    useCampaignStore.setState({
      excursion: {
        ...useCampaignStore.getState().excursion!,
        squad: [{ ...squad[0], hp: midHp, alive: true }, ...squad.slice(1)],
      },
    });
    useCampaignStore.getState().extract();
    expect(useCampaignStore.getState().woundedIds[squad[0].soldierId]).toBe(1);
  });

  it('soldiers above 60% HP return to roster unwounded', () => {
    const squad = useCampaignStore.getState().excursion!.squad;
    const t = useContent().soldierTemplates[squad[0].soldierId]!;
    const fullHp = t.hpMax;
    useCampaignStore.setState({
      excursion: {
        ...useCampaignStore.getState().excursion!,
        squad: [{ ...squad[0], hp: fullHp, alive: true }, ...squad.slice(1)],
      },
    });
    useCampaignStore.getState().extract();
    expect(useCampaignStore.getState().woundedIds[squad[0].soldierId]).toBeUndefined();
  });

  it('downed soldiers take max wound regardless of stored HP', () => {
    const squad = useCampaignStore.getState().excursion!.squad;
    useCampaignStore.setState({
      excursion: {
        ...useCampaignStore.getState().excursion!,
        // alive=false but hp=7 (nonsense — simulates a stale state check).
        squad: [{ ...squad[0], alive: false, hp: 7 }, ...squad.slice(1)],
      },
    });
    useCampaignStore.getState().extract();
    expect(useCampaignStore.getState().woundedIds[squad[0].soldierId]).toBe(3);
  });

  it('clears the excursion pointer after extracting', () => {
    useCampaignStore.getState().extract();
    expect(useCampaignStore.getState().excursion).toBeNull();
  });

  it('records zone completion only when every mission was finished', () => {
    const zone = activeZone();
    // Without completing any mission — no zone completion.
    useCampaignStore.getState().extract();
    expect(useCampaignStore.getState().completedZoneIds).not.toContain(zone.id);
    // Fresh run, clear every mission, then extract.
    useCampaignStore.getState().startExcursion(zone);
    const squad = useCampaignStore.getState().excursion!.squad;
    for (let i = 0; i < zone.missions.length; i++) {
      useCampaignStore.getState().recordMissionVictory(
        squad.map((s) => mkCarry(s.soldierId)), 0, 0,
      );
    }
    useCampaignStore.getState().extract();
    expect(useCampaignStore.getState().completedZoneIds).toContain(zone.id);
  });
});

describe('campaignStore: consumeItem', () => {
  beforeEach(() => {
    resetCampaign();
    useCampaignStore.getState().startExcursion(activeZone());
    // Guarantee both consumables are present regardless of zone grants.
    const e = useCampaignStore.getState().excursion!;
    useCampaignStore.setState({
      excursion: {
        ...e,
        stockpile: { ...e.stockpile, ammo_crate: 2, med_cache: 2 },
      },
    });
  });

  it('med_cache restores +4 HP to every living soldier, clamped to hpMax', () => {
    const squad = useCampaignStore.getState().excursion!.squad;
    // Wound two soldiers, down one, leave one at full.
    const pack = useContent();
    useCampaignStore.setState({
      excursion: {
        ...useCampaignStore.getState().excursion!,
        squad: [
          { ...squad[0], hp: 2, alive: true },
          { ...squad[1], hp: pack.soldierTemplates[squad[1].soldierId]!.hpMax - 1, alive: true },
          { ...squad[2], hp: pack.soldierTemplates[squad[2].soldierId]!.hpMax, alive: true },
          { ...squad[3], hp: 0, alive: false },
        ],
      },
    });
    const ok = useCampaignStore.getState().consumeItem('med_cache');
    expect(ok).toBe(true);
    const [s0, s1, s2, s3] = useCampaignStore.getState().excursion!.squad;
    // First soldier heals by full 4.
    expect(s0.hp).toBe(6);
    // Second soldier heals from hpMax-1 to hpMax (clamp).
    expect(s1.hp).toBe(pack.soldierTemplates[s1.soldierId]!.hpMax);
    // Third at hpMax stays at hpMax.
    expect(s2.hp).toBe(pack.soldierTemplates[s2.soldierId]!.hpMax);
    // Downed soldier untouched.
    expect(s3.hp).toBe(0);
    expect(s3.alive).toBe(false);
    // Stockpile decremented.
    expect(useCampaignStore.getState().excursion!.stockpile.med_cache).toBe(1);
  });

  it('ammo_crate sets ammo to a high number so initMission clamps to the real cap', () => {
    const squad = useCampaignStore.getState().excursion!.squad;
    useCampaignStore.setState({
      excursion: {
        ...useCampaignStore.getState().excursion!,
        squad: squad.map((s) => ({ ...s, ammoPrimary: 1, ammoSidearm: 1 })),
      },
    });
    const ok = useCampaignStore.getState().consumeItem('ammo_crate');
    expect(ok).toBe(true);
    const after = useCampaignStore.getState().excursion!.squad;
    for (const s of after) {
      // The next initMission clamps this to weapon+kit cap (tested in combat store).
      // Here we just assert the handshake value is non-trivial.
      expect(s.ammoPrimary).toBeGreaterThan(50);
      expect(s.ammoSidearm).toBeGreaterThan(50);
    }
  });

  it('returns false and leaves stockpile alone when count is 0', () => {
    useCampaignStore.setState({
      excursion: {
        ...useCampaignStore.getState().excursion!,
        stockpile: { med_cache: 0 },
      },
    });
    expect(useCampaignStore.getState().consumeItem('med_cache')).toBe(false);
    expect(useCampaignStore.getState().excursion!.stockpile.med_cache).toBe(0);
  });

  it('returns false for an unhandled item id (phase-1 scope)', () => {
    useCampaignStore.setState({
      excursion: {
        ...useCampaignStore.getState().excursion!,
        stockpile: { armor_patch: 1 },
      },
    });
    expect(useCampaignStore.getState().consumeItem('armor_patch')).toBe(false);
    // Count should be unchanged — nothing was spent.
    expect(useCampaignStore.getState().excursion!.stockpile.armor_patch).toBe(1);
  });

  it('is a no-op when no excursion is active', () => {
    useCampaignStore.setState({ excursion: null });
    expect(useCampaignStore.getState().consumeItem('med_cache')).toBe(false);
  });
});

describe('campaignStore: recordMissionDefeat', () => {
  beforeEach(() => { resetCampaign(); useCampaignStore.getState().startExcursion(activeZone()); });

  it('appends a defeat entry and accumulates stats without advancing missions', () => {
    const before = useCampaignStore.getState().excursion!;
    const squad = before.squad.map((s) => mkCarry(s.soldierId));
    useCampaignStore.getState().recordMissionDefeat(squad, 2, 9);
    const e = useCampaignStore.getState().excursion!;
    expect(e.history.at(-1)).toMatchObject({ kind: 'mission', outcome: 'defeat' });
    expect(e.currentMissionIdx).toBe(before.currentMissionIdx);
    expect(e.totalKills).toBe(2);
    expect(e.totalDamageTaken).toBe(9);
  });

  it('treats kills/damage as 0 when omitted', () => {
    const squad = useCampaignStore.getState().excursion!.squad.map((s) => mkCarry(s.soldierId));
    useCampaignStore.getState().recordMissionDefeat(squad);
    const e = useCampaignStore.getState().excursion!;
    expect(e.totalKills).toBe(0);
    expect(e.totalDamageTaken).toBe(0);
  });
});

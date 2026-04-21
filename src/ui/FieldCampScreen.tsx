import { useGameStore } from '../state/gameStore';
import { useCampaignStore } from '../state/campaignStore';
import { useCombatStore } from '../state/combatStore';
import { useContent } from '../content/registry';
import { ALL_MAPS } from '../game/maps';
import type { GridMap, Skirmish } from '../game/types';

/**
 * Field Camp — a between-mission resupply screen. After each mission
 * victory the squad pitches camp before pushing to the next plot point
 * on the excursion map. The player can spend stockpile consumables here
 * to reload magazines and patch up the wounded; when the current
 * excursion has no missions left, the "March on" button routes to the
 * Excursion Complete screen instead of the mission map.
 *
 * Only the two most combat-relevant consumables are usable right now:
 *  - Ammo Crate  → refills every living soldier's primary + sidearm
 *  - Med Cache   → +4 HP to every living soldier (capped by hpMax)
 * The other consumable kinds sit in the stockpile, display-only, and
 * will activate once their feature lands.
 */
export default function FieldCampScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const excursion = useCampaignStore((s) => s.excursion);
  const consumeItem = useCampaignStore((s) => s.consumeItem);
  const pack = useContent();

  if (!excursion) {
    return (
      <div className="screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="panel stack" style={{ padding: 'var(--s-3)' }}>
          <p>No active excursion.</p>
          <button className="primary" onClick={() => setScreen('menu')}>Return to Base</button>
        </div>
      </div>
    );
  }
  const zone = pack.zones?.find((z) => z.id === excursion.zoneId);
  if (!zone) return null;

  const lastMissionIdx = excursion.completedMissionIdx[excursion.completedMissionIdx.length - 1];
  const justFinished = lastMissionIdx !== undefined ? zone.missions[lastMissionIdx] : null;
  const allDone = excursion.extractionReady;

  function onMarchOn() {
    if (allDone) { setScreen('excursionComplete'); return; }
    // Roll for a road-skirmish on the march between camp and the next plot
    // point. Weaker, fewer enemies than a real mission — flavour + resource
    // drain rather than a run-ender. If no roll hits (or the zone defines
    // none) we slide straight to the excursion map.
    const pack = useContent();
    const z = pack.zones?.find((z) => z.id === excursion!.zoneId);
    const skirmish = rollSkirmish(z?.skirmishChance ?? 0, z?.skirmishes ?? []);
    if (!skirmish) { setScreen('excursion'); return; }
    const map = ALL_MAPS.find((m) => m.id === skirmish.mapId);
    if (!map) { setScreen('excursion'); return; }
    const aliveSquad = excursion!.squad.filter((s) => s.alive);
    const carries: Record<string, { hp: number; ammoPrimary: number; ammoSidearm: number; utilityCharges: number[]; dirt: number }> = {};
    for (const s of aliveSquad) {
      carries[s.soldierId] = {
        hp: s.hp, ammoPrimary: s.ammoPrimary, ammoSidearm: s.ammoSidearm,
        utilityCharges: s.utilityCharges, dirt: s.dirt,
      };
    }
    // Skirmishes run on the same maps as missions, but with fewer and
    // weaker enemies. We clone the map with a filtered enemySpawns list.
    const skirmishMap: GridMap = { ...map, enemySpawns: thinEnemySpawns(map.enemySpawns) };
    useCombatStore.getState().initMission({
      map: skirmishMap,
      rosterIds: aliveSquad.map((s) => s.soldierId),
      carries,
      briefing: `Ambush! ${skirmish.flavor}`,
      isSkirmish: true,
    });
    useCampaignStore.getState().beginSkirmish(skirmish.id);
    setScreen('combat');
  }

  function rollSkirmish(chance: number, pool: Skirmish[]): Skirmish | null {
    if (chance <= 0 || pool.length === 0) return null;
    if (Math.random() >= chance) return null;
    const totalWeight = pool.reduce((s, k) => s + Math.max(1, k.weight), 0);
    let r = Math.random() * totalWeight;
    for (const s of pool) {
      r -= Math.max(1, s.weight);
      if (r <= 0) return s;
    }
    return pool[pool.length - 1];
  }

  /**
   * Keep only the weakest spawn key (the first letter that appears at all —
   * the map ASCII orders G/O/T in our packs, so 'G' survives by default)
   * and cap the count at 2–3 so a skirmish genuinely feels like an
   * ambush rather than a second full mission.
   */
  function thinEnemySpawns(spawns: GridMap['enemySpawns']): GridMap['enemySpawns'] {
    if (spawns.length === 0) return spawns;
    // Bucket by spawn key, pick the lexicographically smallest present
    // (maps order weakest → strongest alphabetically: G < O < T).
    const keys = [...new Set(spawns.map((s) => s.spawnKey))].sort();
    const weakestKey = keys[0];
    const weakest = spawns.filter((s) => s.spawnKey === weakestKey);
    // 2-3 enemies, at most however many are available.
    const count = Math.min(weakest.length, 2 + Math.floor(Math.random() * 2));
    // Shuffle deterministically-ish; drop extras.
    const copy = [...weakest].sort(() => Math.random() - 0.5);
    return copy.slice(0, count);
  }

  const ammoCount = excursion.stockpile['ammo_crate'] ?? 0;
  const medCount = excursion.stockpile['med_cache'] ?? 0;

  return (
    <div className="screen stack" style={{ padding: 'var(--s-3)', gap: 'var(--s-3)', overflow: 'hidden' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ width: 64 }} />
        <div className="stack" style={{ alignItems: 'center', gap: 2 }}>
          <h2 style={{ margin: 0 }}>Field Camp</h2>
          <span style={{ fontSize: 11, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
            {zone.name}
          </span>
        </div>
        <button className="primary" onClick={onMarchOn}>
          {allDone ? 'Extract' : 'March on'}
        </button>
      </div>

      {justFinished && (
        <div className="panel stack" style={{ padding: 'var(--s-3)' }}>
          <span style={{ fontSize: 11, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
            After action
          </span>
          <h3 style={{ margin: 0 }}>✓ {justFinished.name}</h3>
          <p style={{ fontSize: 13, color: 'var(--fg-1)', margin: 0 }}>
            Objective cleared. The squad makes camp in the lee of the dunes.
          </p>
        </div>
      )}

      <div className="scroll-y" style={{ flex: 1 }}>
        {/* Squad status — same layout the Excursion map uses so the player
            has continuity between screens. */}
        <section className="panel stack" style={{ marginBottom: 'var(--s-3)' }}>
          <h3 style={{ fontSize: 12, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: 0.6 }}>Squad</h3>
          {excursion.squad.map((s) => {
            const t = pack.soldierTemplates[s.soldierId];
            const pct = t ? Math.max(0, Math.min(1, s.hp / t.hpMax)) : 0;
            return (
              <div key={s.soldierId} className="stack" style={{ gap: 4, opacity: s.alive ? 1 : 0.45 }}>
                <div className="row" style={{ gap: 'var(--s-3)', alignItems: 'center' }}>
                  <div style={{ width: 12, height: 12, background: t?.portraitColor ?? '#fff', borderRadius: 3 }} />
                  <div style={{ flex: 1, fontSize: 13 }}>{t?.name ?? s.soldierId}</div>
                  {s.alive
                    ? <div style={{ fontSize: 11, color: 'var(--fg-1)' }}>HP {s.hp}/{t?.hpMax ?? '?'}</div>
                    : <div style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 600 }}>DOWN · benched</div>}
                </div>
                {s.alive && (
                  <div style={{ height: 4, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      width: `${pct * 100}%`, height: '100%',
                      background: pct > 0.6 ? 'var(--success)' : pct > 0.3 ? 'var(--accent)' : 'var(--danger)',
                      transition: 'width 0.2s ease',
                    }} />
                  </div>
                )}
              </div>
            );
          })}
        </section>

        {/* Active supplies — ammo + med. Other consumables display below. */}
        <section className="panel stack" style={{ marginBottom: 'var(--s-3)' }}>
          <h3 style={{ fontSize: 12, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
            Rations &amp; Supplies
          </h3>
          <SupplyRow
            name="Ammo Crate" count={ammoCount} disabled={ammoCount <= 0}
            desc="Refill every living soldier's primary + sidearm magazine."
            onUse={() => consumeItem('ammo_crate')} />
          <SupplyRow
            name="Med Cache" count={medCount} disabled={medCount <= 0}
            desc="Patch up the squad: +4 HP to every living soldier."
            onUse={() => consumeItem('med_cache')} />
        </section>

        {/* Other stockpile items — informational only for now. */}
        {Object.keys(excursion.stockpile).length > 0 && (
          <section className="panel stack">
            <h3 style={{ fontSize: 12, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
              Other Supplies
            </h3>
            <div className="row" style={{ flexWrap: 'wrap', gap: 'var(--s-2)' }}>
              {Object.entries(excursion.stockpile).map(([id, count]) => {
                if (id === 'ammo_crate' || id === 'med_cache') return null;
                const c = pack.consumables?.[id];
                if (!c || count <= 0) return null;
                return (
                  <div key={id} style={{
                    fontSize: 12, padding: '6px 10px', border: '1px dashed var(--bg-3)',
                    borderRadius: 'var(--r-sm)',
                  }}>
                    <strong>{c.name}</strong> × {count}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function SupplyRow({ name, count, disabled, desc, onUse }:
  { name: string; count: number; disabled: boolean; desc: string; onUse: () => void }) {
  return (
    <div className="row" style={{
      gap: 'var(--s-3)', alignItems: 'center',
      padding: 'var(--s-2)', borderRadius: 'var(--r-sm)',
      background: 'var(--bg-2)',
    }}>
      <div style={{ flex: 1 }}>
        <div className="row" style={{ gap: 'var(--s-2)', alignItems: 'center' }}>
          <strong style={{ fontSize: 13 }}>{name}</strong>
          <span style={{ fontSize: 12, color: 'var(--fg-2)' }}>× {count}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--fg-1)', marginTop: 2 }}>{desc}</div>
      </div>
      <button disabled={disabled} onClick={onUse}
        style={{ minWidth: 68, opacity: disabled ? 0.45 : 1 }}>Use</button>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { SOLDIERS } from '../game/data/soldiers';
import { WEAPONS, PRIMARY_WEAPONS, SIDEARMS } from '../game/data/weapons';
import { ARMOR, ALL_ARMOR } from '../game/data/armor';
import { ALL_UTILITIES } from '../game/data/utilities';
import type { Loadout } from '../game/types';

const MAX_UTILITIES = 2;

export default function LoadoutScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const roster = useGameStore((s) => s.roster);
  const loadouts = useGameStore((s) => s.loadouts);
  const setLoadout = useGameStore((s) => s.setLoadout);
  const [idx, setIdx] = useState(0);
  const soldierId = roster[idx];
  const soldier = SOLDIERS[soldierId]!;
  const current = loadouts[soldierId];

  const armor = ARMOR[current.armorId];
  const primary = WEAPONS[current.primaryId];

  const derived = useMemo(() => ({
    hpMax: soldier.hpMax + (armor?.hpBonus ?? 0),
    mobility: Math.max(2, soldier.mobility + (armor?.mobility ?? 0)),
    aim: soldier.aim + (primary?.aim ?? 0),
  }), [soldier, armor, primary]);

  function set(partial: Partial<Loadout>) {
    setLoadout(soldierId, { ...current, ...partial });
  }
  function toggleUtility(id: string) {
    const have = current.utilityIds.includes(id);
    if (have) {
      const idx = current.utilityIds.indexOf(id);
      const next = [...current.utilityIds];
      next.splice(idx, 1);
      set({ utilityIds: next });
    } else if (current.utilityIds.length < MAX_UTILITIES) {
      set({ utilityIds: [...current.utilityIds, id] });
    }
  }

  return (
    <div className="screen stack" style={{ padding: 'var(--s-3)', gap: 'var(--s-3)', overflow: 'hidden' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button onClick={() => setScreen('menu')}>Back</button>
        <h2>Loadout</h2>
        <button className="primary" onClick={() => setScreen('combat')}>Deploy</button>
      </div>

      <div className="row scroll-x" style={{ gap: 'var(--s-2)', paddingBottom: 4 }}>
        {roster.map((sid, i) => {
          const s = SOLDIERS[sid]!;
          return (
            <button key={sid} onClick={() => setIdx(i)}
              style={{
                borderColor: i === idx ? 'var(--accent)' : 'var(--bg-3)',
                background: i === idx ? 'var(--bg-3)' : 'var(--bg-2)',
                minWidth: 110,
              }}>
              <div style={{ width: 18, height: 18, background: s.portraitColor, borderRadius: 4, display: 'inline-block', marginRight: 6, verticalAlign: 'middle' }} />
              <span style={{ verticalAlign: 'middle' }}>{s.name}</span>
              <div style={{ fontSize: 11, color: 'var(--fg-2)', marginTop: 2 }}>{s.class}</div>
            </button>
          );
        })}
      </div>

      <div className="scroll-y" style={{ flex: 1, paddingRight: 4 }}>
        <div className="panel stack">
          <div className="row" style={{ gap: 'var(--s-4)', alignItems: 'flex-start' }}>
            <div style={{ width: 48, height: 48, background: soldier.portraitColor, borderRadius: 'var(--r-md)', flexShrink: 0 }} />
            <div className="stack" style={{ gap: 4, flex: 1 }}>
              <h2>{soldier.name}</h2>
              <p>{soldier.class}</p>
              <div className="row" style={{ gap: 'var(--s-4)', color: 'var(--fg-1)', fontSize: 14 }}>
                <span>HP {derived.hpMax}</span>
                <span>Aim {derived.aim >= 0 ? '+' : ''}{derived.aim}</span>
                <span>Move {derived.mobility}</span>
              </div>
            </div>
          </div>
        </div>

        <Section title="Primary Weapon">
          <Grid>
            {PRIMARY_WEAPONS.map((w) => (
              <Card key={w.id} selected={current.primaryId === w.id} onClick={() => set({ primaryId: w.id })}
                title={w.name} tag={w.tag}
                lines={[
                  `${w.dmgMin}–${w.dmgMax} dmg · ${w.aim >= 0 ? '+' : ''}${w.aim} aim · ${w.crit}% crit`,
                  `Range ${w.rangeShort}/${w.rangeLong} · Ammo ${w.ammo} · ${w.apCost} AP${w.endsTurn ? ' · ends turn' : ''}`,
                  w.flavor,
                ]} />
            ))}
          </Grid>
        </Section>

        <Section title="Sidearm">
          <Grid>
            {SIDEARMS.map((w) => (
              <Card key={w.id} selected={current.sidearmId === w.id} onClick={() => set({ sidearmId: w.id })}
                title={w.name} tag={w.tag}
                lines={[
                  `${w.dmgMin}–${w.dmgMax} dmg · ${w.aim >= 0 ? '+' : ''}${w.aim} aim · ${w.crit}% crit`,
                  w.flavor,
                ]} />
            ))}
          </Grid>
        </Section>

        <Section title="Armor">
          <Grid>
            {ALL_ARMOR.map((a) => (
              <Card key={a.id} selected={current.armorId === a.id} onClick={() => set({ armorId: a.id })}
                title={a.name} tag={a.tag}
                lines={[
                  `+${a.hpBonus} HP · ${a.dr} DR · ${a.mobility >= 0 ? '+' : ''}${a.mobility} move`,
                  a.flavor,
                ]} />
            ))}
          </Grid>
        </Section>

        <Section title={`Utilities (${current.utilityIds.length}/${MAX_UTILITIES})`}>
          <Grid>
            {ALL_UTILITIES.map((u) => {
              const count = current.utilityIds.filter((x) => x === u.id).length;
              return (
                <Card key={u.id} selected={count > 0} onClick={() => toggleUtility(u.id)}
                  title={`${u.name}${count > 1 ? ` ×${count}` : ''}`} tag={u.tag}
                  lines={[
                    `${u.kind}${u.dmgMin !== undefined ? ` · ${u.dmgMin}–${u.dmgMax} dmg` : ''}${u.heal ? ` · heals ${u.heal}` : ''}`,
                    `Radius ${u.radius} · Range ${u.range} · ${u.apCost} AP`,
                    u.flavor,
                  ]} />
              );
            })}
          </Grid>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="stack" style={{ marginTop: 'var(--s-4)' }}>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--s-2)' }}>{children}</div>;
}

const TAG_COLORS: Record<string, string> = {
  runic: 'var(--accent)',
  draconic: 'var(--accent-2)',
  alchemical: 'var(--accent-3)',
  fae: 'var(--accent-4)',
  mundane: 'var(--fg-1)',
};

function Card({ title, tag, lines, selected, onClick }:
  { title: string; tag: string; lines: string[]; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{
        display: 'block', textAlign: 'left', padding: 'var(--s-3)',
        borderColor: selected ? 'var(--accent)' : 'var(--bg-3)',
        background: selected ? 'var(--bg-3)' : 'var(--bg-2)',
        minHeight: 88, width: '100%',
      }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
        <strong>{title}</strong>
        <span style={{ fontSize: 11, color: TAG_COLORS[tag] ?? 'var(--fg-1)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{tag}</span>
      </div>
      {lines.map((l, i) => (
        <div key={i} style={{ fontSize: 12, color: i === lines.length - 1 ? 'var(--fg-2)' : 'var(--fg-1)', fontStyle: i === lines.length - 1 ? 'italic' : 'normal', marginTop: 2 }}>{l}</div>
      ))}
    </button>
  );
}

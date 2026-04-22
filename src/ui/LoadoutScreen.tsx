import { useMemo, useState } from 'react';
import { useGameStore } from '../state/gameStore';
import {
  useContent, getSoldierTemplate, getWeapon, getArmor, getMod,
  allArmor, allUtilities, allKits, primaryWeapons, sidearms,
} from '../content/registry';
import type { Loadout, ModSlot, SoldierTemplate, WeaponClass } from '../game/types';
import { SIDEARM_MOD_SLOTS } from '../game/types';
import ModPicker from './components/ModPicker';
import CharacterCreationScreen from './CharacterCreationScreen';
import SoldierPortrait from './SoldierPortrait';

const MAX_UTILITIES = 2;
const PRIMARY_SLOTS: ModSlot[] = ['optic', 'magazine', 'muzzle', 'stock'];
type Tab = 'weapons' | 'armor' | 'kit' | 'utilities';

export default function LoadoutScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const roster = useGameStore((s) => s.roster);
  const loadouts = useGameStore((s) => s.loadouts);
  const setLoadout = useGameStore((s) => s.setLoadout);
  const setRosterSlot = useGameStore((s) => s.setRosterSlot);
  const addCustomSoldier = useGameStore((s) => s.addCustomSoldier);
  const [idx, setIdx] = useState(0);
  const [tab, setTab] = useState<Tab>('weapons');
  const [picker, setPicker] = useState<{ slot: ModSlot; sidearm: boolean } | null>(null);
  /** When true, the CharacterCreationScreen modal is open. Confirming
   *  drops the new custom soldier into the currently-viewed roster slot
   *  so the player can immediately loadout + deploy them. */
  const [creating, setCreating] = useState<boolean>(false);

  function handleCreateSoldier(tpl: SoldierTemplate): void {
    addCustomSoldier(tpl);
    setRosterSlot(idx, tpl.id);
    setCreating(false);
  }

  const soldierId = roster[idx];
  const soldier = getSoldierTemplate(soldierId);
  const current = loadouts[soldierId];

  const armor = getArmor(current.armorId);
  const primary = getWeapon(current.primaryId);
  const sidearm = getWeapon(current.sidearmId);
  const kit = current.kitId ? useContent().kits[current.kitId] ?? null : null;

  const derived = useMemo(() => {
    const k = kit?.effects ?? {};
    return {
      hpMax: Math.max(1, soldier.hpMax + (armor?.hpBonus ?? 0) + (k.hpBonus ?? 0)),
      mobility: Math.max(2, soldier.mobility + (armor?.mobility ?? 0) + (k.mobilityBonus ?? 0)),
      aim: soldier.aim + (primary?.aim ?? 0) + (k.aimBonus ?? 0),
      ammoPrimary: (primary?.ammo ?? 0) + (k.extraAmmoPrimary ?? 0),
    };
  }, [soldier, armor, primary, kit]);

  function set(partial: Partial<Loadout>) {
    setLoadout(soldierId, { ...current, ...partial });
  }
  function toggleUtility(id: string) {
    const have = current.utilityIds.includes(id);
    if (have) {
      const i = current.utilityIds.indexOf(id);
      const next = [...current.utilityIds];
      next.splice(i, 1);
      set({ utilityIds: next });
    } else if (current.utilityIds.length < MAX_UTILITIES) {
      set({ utilityIds: [...current.utilityIds, id] });
    }
  }
  function setMod(slot: ModSlot, sidearm: boolean, modId: string | null) {
    const slotMap = { ...(sidearm ? current.sidearmMods : current.primaryMods) };
    if (modId === null) delete slotMap[slot];
    else slotMap[slot] = modId;
    set(sidearm ? { sidearmMods: slotMap } : { primaryMods: slotMap });
  }

  return (
    <div className="screen stack" style={{ padding: 'var(--s-3)', gap: 'var(--s-3)', overflow: 'hidden' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button onClick={() => setScreen('menu')}>Back</button>
        <h2>Loadout</h2>
        <div className="row" style={{ gap: 'var(--s-2)' }}>
          <button onClick={() => setCreating(true)} title="Replace current slot with a custom soldier">
            + Create Soldier
          </button>
          <button className="primary" onClick={() => setScreen('combat')}>Deploy</button>
        </div>
      </div>
      {creating && (
        <CharacterCreationScreen
          onCreate={handleCreateSoldier}
          onCancel={() => setCreating(false)}
        />
      )}

      <div className="row scroll-x" style={{ gap: 'var(--s-2)', paddingBottom: 4 }}>
        {roster.map((sid, i) => {
          const s = getSoldierTemplate(sid);
          return (
            <button key={sid} onClick={() => setIdx(i)}
              style={{
                borderColor: i === idx ? 'var(--accent)' : 'var(--bg-3)',
                background: i === idx ? 'var(--bg-3)' : 'var(--bg-2)',
                minWidth: 110,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
              <SoldierPortrait template={s} size={28} />
              <div style={{ textAlign: 'left' }}>
                <div>{s.name}</div>
                <div style={{ fontSize: 11, color: 'var(--fg-2)', marginTop: 2 }}>{s.class}</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="panel stack" style={{ flexShrink: 0 }}>
        <div className="row" style={{ gap: 'var(--s-4)', alignItems: 'flex-start' }}>
          <SoldierPortrait template={soldier} size={48} />
          <div className="stack" style={{ gap: 4, flex: 1 }}>
            <h2>{soldier.name}</h2>
            <p>{soldier.class}</p>
            <div className="row" style={{ gap: 'var(--s-4)', color: 'var(--fg-1)', fontSize: 14, flexWrap: 'wrap' }}>
              <span>HP {derived.hpMax}</span>
              <span>Aim {derived.aim >= 0 ? '+' : ''}{derived.aim}</span>
              <span>Move {derived.mobility}</span>
              <span>Ammo {derived.ammoPrimary}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="row" style={{ gap: 'var(--s-2)', flexShrink: 0 }}>
        {(['weapons', 'armor', 'kit', 'utilities'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              flex: 1,
              borderColor: tab === t ? 'var(--accent)' : 'var(--bg-3)',
              background: tab === t ? 'var(--bg-3)' : 'var(--bg-2)',
              fontSize: 13, padding: '8px 4px',
            }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="scroll-y" style={{ flex: 1, paddingRight: 4 }}>
        {tab === 'weapons' && (
          <>
            <EquippedArmory primary={primary} sidearm={sidearm} />

            <Section title={`Primary · ${primary?.name ?? '—'}`}>
              <ModSlotRow weapon={primary?.class} slots={PRIMARY_SLOTS}
                slotMap={current.primaryMods}
                onSlotClick={(slot) => setPicker({ slot, sidearm: false })} />
              <Grid>
                {primaryWeapons().map((w) => (
                  <Card key={w.id} selected={current.primaryId === w.id}
                    onClick={() => set({ primaryId: w.id, primaryMods: {} })}
                    title={w.name} tag={w.tag} imgSrc={w.spritePath}
                    lines={[
                      `${w.dmgMin}–${w.dmgMax} dmg · ${w.aim >= 0 ? '+' : ''}${w.aim} aim · ${w.crit}% crit`,
                      `Range ${w.rangeShort}/${w.rangeLong} · Ammo ${w.ammo} · ${w.apCost} AP${w.endsTurn ? ' · ends turn' : ''}`,
                      w.flavor,
                    ]} />
                ))}
              </Grid>
            </Section>

            <Section title={`Sidearm · ${sidearm?.name ?? '—'}`}>
              <ModSlotRow weapon={sidearm?.class} slots={SIDEARM_MOD_SLOTS}
                slotMap={current.sidearmMods}
                onSlotClick={(slot) => setPicker({ slot, sidearm: true })} />
              <Grid>
                {sidearms().map((w) => (
                  <Card key={w.id} selected={current.sidearmId === w.id}
                    onClick={() => set({ sidearmId: w.id, sidearmMods: {} })}
                    title={w.name} tag={w.tag} imgSrc={w.spritePath}
                    lines={[
                      `${w.dmgMin}–${w.dmgMax} dmg · ${w.aim >= 0 ? '+' : ''}${w.aim} aim · ${w.crit}% crit`,
                      w.flavor,
                    ]} />
                ))}
              </Grid>
            </Section>
          </>
        )}

        {tab === 'armor' && (
          <Section title="Armor">
            <Grid>
              {allArmor().map((a) => (
                <Card key={a.id} selected={current.armorId === a.id} onClick={() => set({ armorId: a.id })}
                  title={a.name} tag={a.tag}
                  lines={[
                    `+${a.hpBonus} HP · ${a.dr} DR · ${a.mobility >= 0 ? '+' : ''}${a.mobility} move`,
                    a.flavor,
                  ]} />
              ))}
            </Grid>
          </Section>
        )}

        {tab === 'kit' && (
          <Section title={`Kit ${kit ? `· ${kit.name}` : '· (none)'}`}>
            <Grid>
              <Card selected={current.kitId === null} onClick={() => set({ kitId: null })}
                title="No Kit" tag="mundane"
                lines={['No passive equipment.', 'Free up the slot for a clean run.']} />
              {allKits().map((k) => (
                <Card key={k.id} selected={current.kitId === k.id} onClick={() => set({ kitId: k.id })}
                  title={k.name} tag={k.tag}
                  lines={[describeKitEffects(k.effects), k.flavor]} />
              ))}
            </Grid>
          </Section>
        )}

        {tab === 'utilities' && (
          <Section title={`Utilities (${current.utilityIds.length}/${MAX_UTILITIES})`}>
            <Grid>
              {allUtilities().map((u) => {
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
        )}
      </div>

      {picker && (() => {
        const wpn = picker.sidearm ? sidearm : primary;
        if (!wpn) return null;
        const cur = (picker.sidearm ? current.sidearmMods : current.primaryMods)[picker.slot] ?? null;
        return (
          <ModPicker
            slot={picker.slot}
            weaponClass={wpn.class}
            currentModId={cur}
            onPick={(modId) => setMod(picker.slot, picker.sidearm, modId)}
            onClose={() => setPicker(null)}
            title={`${picker.sidearm ? 'Sidearm' : 'Primary'} · ${picker.slot}`}
          />
        );
      })()}
    </div>
  );
}

function ModSlotRow({ weapon, slots, slotMap, onSlotClick }:
  { weapon?: WeaponClass; slots: ModSlot[]; slotMap: Partial<Record<ModSlot, string>>;
    onSlotClick: (slot: ModSlot) => void }) {
  if (!weapon) return null;
  return (
    <div className="row" style={{ gap: 'var(--s-2)', marginBottom: 'var(--s-3)', flexWrap: 'wrap' }}>
      {slots.map((slot) => {
        const id = slotMap[slot];
        const mod = id ? getMod(id) : null;
        return (
          <button key={slot} onClick={() => onSlotClick(slot)}
            style={{
              flex: '1 1 130px', minHeight: 56, padding: 'var(--s-2)',
              display: 'block', textAlign: 'left',
              borderColor: mod ? 'var(--accent)' : 'var(--bg-3)',
              background: mod ? 'var(--bg-3)' : 'var(--bg-2)',
              borderStyle: mod ? 'solid' : 'dashed',
            }}>
            <div style={{ fontSize: 10, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
              {slot}
            </div>
            <div style={{ fontSize: 13, color: mod ? 'var(--fg-0)' : 'var(--fg-2)', marginTop: 2 }}>
              {mod?.name ?? `+ Add ${slot}`}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="stack" style={{ marginTop: 'var(--s-3)' }}>
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

function Card({ title, tag, lines, selected, onClick, imgSrc }:
  { title: string; tag: string; lines: string[]; selected: boolean;
    onClick: () => void; imgSrc?: string }) {
  return (
    <button onClick={onClick}
      style={{
        display: 'block', textAlign: 'left', padding: 'var(--s-3)',
        borderColor: selected ? 'var(--accent)' : 'var(--bg-3)',
        background: selected ? 'var(--bg-3)' : 'var(--bg-2)',
        minHeight: 88, width: '100%',
      }}>
      <div className="row" style={{ gap: 'var(--s-2)', alignItems: 'flex-start' }}>
        {imgSrc && (
          <div style={{
            width: 56, height: 70, flexShrink: 0,
            background: 'var(--bg-1)', borderRadius: 4,
            border: '1px solid var(--bg-3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
          }}>
            <img src={imgSrc} alt="" width={52} height={66}
              style={{ objectFit: 'contain', pointerEvents: 'none' }} />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
            <strong>{title}</strong>
            <span style={{ fontSize: 11, color: TAG_COLORS[tag] ?? 'var(--fg-1)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{tag}</span>
          </div>
          {lines.map((l, i) => (
            <div key={i} style={{ fontSize: 12, color: i === lines.length - 1 ? 'var(--fg-2)' : 'var(--fg-1)', fontStyle: i === lines.length - 1 ? 'italic' : 'normal', marginTop: 2 }}>{l}</div>
          ))}
        </div>
      </div>
    </button>
  );
}

/**
 * Big armory banner for the weapons tab — shows the current primary +
 * sidearm sprites at a glance so the player can see exactly what their
 * soldier will carry into the mission. Uses the shared weapon.spritePath
 * so the preview matches what renders in combat.
 */
function EquippedArmory({ primary, sidearm }:
  { primary: import('../game/types').Weapon | null;
    sidearm: import('../game/types').Weapon | null }) {
  if (!primary && !sidearm) return null;
  return (
    <div className="panel row" style={{
      gap: 'var(--s-3)', alignItems: 'center', justifyContent: 'center',
      padding: 'var(--s-3)', marginTop: 'var(--s-2)',
      background: 'var(--bg-1)',
    }}>
      {primary && <ArmorySlot label="Primary" weapon={primary} size={116} />}
      {sidearm && <ArmorySlot label="Sidearm" weapon={sidearm} size={88} />}
    </div>
  );
}

function ArmorySlot({ label, weapon, size }:
  { label: string; weapon: import('../game/types').Weapon; size: number }) {
  const imgH = Math.round(size * 0.72);
  return (
    <div className="stack" style={{ alignItems: 'center', gap: 2 }}>
      <div style={{
        width: size, height: imgH,
        background: 'var(--bg-2)', borderRadius: 6,
        border: '1px solid var(--bg-3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {weapon.spritePath
          ? <img src={weapon.spritePath} alt="" width={size - 8} height={imgH - 8}
              style={{ objectFit: 'contain' }} />
          : <span style={{ color: 'var(--fg-2)', fontSize: 11 }}>no art</span>}
      </div>
      <div style={{ fontSize: 10, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</div>
      <div style={{ fontSize: 12, color: 'var(--fg-1)' }}>{weapon.name}</div>
    </div>
  );
}

function describeKitEffects(e: import('../game/types').Kit['effects']): string {
  const parts: string[] = [];
  if (e.hpBonus !== undefined) parts.push(`${e.hpBonus >= 0 ? '+' : ''}${e.hpBonus} HP`);
  if (e.mobilityBonus !== undefined) parts.push(`${e.mobilityBonus >= 0 ? '+' : ''}${e.mobilityBonus} move`);
  if (e.aimBonus !== undefined) parts.push(`${e.aimBonus >= 0 ? '+' : ''}${e.aimBonus} aim`);
  if (e.extraAmmoPrimary !== undefined) parts.push(`+${e.extraAmmoPrimary} primary ammo`);
  if (e.extraAmmoSidearm !== undefined) parts.push(`+${e.extraAmmoSidearm} sidearm ammo`);
  if (e.extraUtilityCharges !== undefined) parts.push(`+${e.extraUtilityCharges} utility charge${e.extraUtilityCharges === 1 ? '' : 's'}`);
  return parts.join(' · ') || 'No effect';
}

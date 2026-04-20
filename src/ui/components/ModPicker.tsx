import type { ModSlot, WeaponClass, WeaponMod } from '../../game/types';
import { modsFor } from '../../game/data/mods';

const TAG_COLORS: Record<string, string> = {
  runic: 'var(--accent)',
  draconic: 'var(--accent-2)',
  alchemical: 'var(--accent-3)',
  fae: 'var(--accent-4)',
  mundane: 'var(--fg-1)',
};
const TAG_ORDER: Array<keyof typeof TAG_COLORS> = ['runic', 'draconic', 'alchemical', 'fae', 'mundane'];

export type ModPickerProps = {
  slot: ModSlot;
  weaponClass: WeaponClass;
  currentModId: string | null;
  /** Pass `null` to clear the slot. */
  onPick: (modId: string | null) => void;
  onClose: () => void;
  /** Optional title override (e.g. "Refit · Optic"). */
  title?: string;
};

/** Modal-style picker. Lists mods grouped by ElementTag, filtered to the slot. */
export default function ModPicker(props: ModPickerProps) {
  const { slot, weaponClass, currentModId, onPick, onClose, title } = props;
  const candidates = modsFor(slot, weaponClass);
  const grouped: Record<string, WeaponMod[]> = {};
  for (const m of candidates) (grouped[m.tag] ??= []).push(m);

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 'var(--s-3)',
    }}>
      <div onClick={(e) => e.stopPropagation()} className="panel" style={{
        width: '100%', maxWidth: 420, maxHeight: '88vh', overflowY: 'auto',
        padding: 'var(--s-3)', display: 'flex', flexDirection: 'column', gap: 'var(--s-3)',
      }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 18 }}>{title ?? `Pick · ${slot}`}</h2>
          <button onClick={onClose}>Close</button>
        </div>

        <button
          onClick={() => { onPick(null); onClose(); }}
          style={{
            display: 'block', textAlign: 'left', padding: 'var(--s-3)',
            borderColor: currentModId === null ? 'var(--accent)' : 'var(--bg-3)',
            background: currentModId === null ? 'var(--bg-3)' : 'var(--bg-2)',
          }}>
          <strong>None</strong>
          <div style={{ fontSize: 12, color: 'var(--fg-2)', marginTop: 2 }}>Leave the slot empty.</div>
        </button>

        {TAG_ORDER.filter((t) => grouped[t]?.length).map((tag) => (
          <section key={tag} className="stack">
            <h3 style={{ color: TAG_COLORS[tag], fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase' }}>
              {tag}
            </h3>
            {grouped[tag].map((m) => {
              const selected = currentModId === m.id;
              return (
                <button key={m.id} onClick={() => { onPick(m.id); onClose(); }}
                  style={{
                    display: 'block', textAlign: 'left', padding: 'var(--s-3)',
                    borderColor: selected ? 'var(--accent)' : 'var(--bg-3)',
                    background: selected ? 'var(--bg-3)' : 'var(--bg-2)',
                  }}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <strong>{m.name}</strong>
                    <span style={{ fontSize: 11, color: TAG_COLORS[tag] }}>{tag}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--fg-1)', marginTop: 2 }}>
                    {describeEffects(m)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--fg-2)', marginTop: 2, fontStyle: 'italic' }}>
                    {m.flavor}
                  </div>
                </button>
              );
            })}
          </section>
        ))}

        {candidates.length === 0 && (
          <div style={{ color: 'var(--fg-2)', fontSize: 13, padding: 'var(--s-3)' }}>
            No mods fit a {weaponClass} weapon's {slot} slot yet.
          </div>
        )}
      </div>
    </div>
  );
}

function describeEffects(m: WeaponMod): string {
  const e = m.effects;
  const parts: string[] = [];
  if (e.aim) parts.push(`${e.aim >= 0 ? '+' : ''}${e.aim} aim`);
  if (e.crit) parts.push(`${e.crit >= 0 ? '+' : ''}${e.crit}% crit`);
  if (e.dmgMin || e.dmgMax) {
    const lo = e.dmgMin ?? 0, hi = e.dmgMax ?? 0;
    if (lo === hi) parts.push(`${lo >= 0 ? '+' : ''}${lo} dmg`);
    else parts.push(`${lo >= 0 ? '+' : ''}${lo}/${hi >= 0 ? '+' : ''}${hi} dmg`);
  }
  if (e.ammo) parts.push(`${e.ammo >= 0 ? '+' : ''}${e.ammo} ammo`);
  if (e.mobility) parts.push(`${e.mobility >= 0 ? '+' : ''}${e.mobility} move`);
  if (e.flags?.includes('thermal')) parts.push('sees through smoke');
  if (e.flags?.includes('piercing')) parts.push('−2 effective DR');
  if (e.flags?.includes('no_range_falloff')) parts.push('no range penalty');
  if (e.flags?.includes('recover_ammo_on_crit')) parts.push('refund on crit');
  return parts.join(' · ') || 'No mechanical effect';
}

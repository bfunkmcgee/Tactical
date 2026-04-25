import { useState } from 'react';
import { getMod, getWeapon } from '../../content/registry';
import { SIDEARM_MOD_SLOTS } from '../../game/types';
import type { ModSlot, Unit } from '../../game/types';
import ModPicker from '../components/ModPicker';

/**
 * Field Refit overlay — modal that lets the player swap weapon mods on
 * a selected soldier mid-mission. Each slot click opens a <ModPicker>
 * for that slot; tryRefit() resolves the swap (and charges 1 AP).
 *
 * Owned by CombatHUD as a self-contained piece: the overlay's local
 * picker state lives here, so the HUD shell only knows whether the
 * overlay is open or closed.
 */
export interface RefitOverlayProps {
  unit: Unit;
  onClose: () => void;
  onPickMod: (slot: ModSlot, sidearm: boolean, modId: string | null) => void;
}

const PRIMARY_SLOTS: ModSlot[] = ['optic', 'magazine', 'muzzle', 'stock'];

export default function RefitOverlay({ unit, onClose, onPickMod }: RefitOverlayProps) {
  const [picker, setPicker] = useState<{ slot: ModSlot; sidearm: boolean } | null>(null);

  if (!unit.loadout) return null;
  const p = getWeapon(unit.loadout.primaryId);
  const s = getWeapon(unit.loadout.sidearmId);

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 'var(--s-3)',
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="panel stack"
          style={{
            maxWidth: 380, width: '100%', padding: 'var(--s-3)', gap: 'var(--s-3)',
            maxHeight: '88vh', overflowY: 'auto',
          }}
        >
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: 18 }}>Field Refit · {unit.name}</h2>
            <button onClick={onClose}>Done</button>
          </div>
          <p style={{ fontSize: 12 }}>
            Each swap costs <strong>1 AP</strong>. Current AP: <strong>{unit.ap}/{unit.apMax}</strong>.
          </p>

          <RefitWeaponPanel
            name={p?.name ?? 'Primary'} subtitle={p?.class ?? ''}
            slots={PRIMARY_SLOTS} slotMap={unit.loadout.primaryMods}
            disabled={unit.ap < 1}
            onSlotClick={(slot) => setPicker({ slot, sidearm: false })}
          />
          <RefitWeaponPanel
            name={s?.name ?? 'Sidearm'} subtitle={s?.class ?? ''}
            slots={SIDEARM_MOD_SLOTS} slotMap={unit.loadout.sidearmMods}
            disabled={unit.ap < 1}
            onSlotClick={(slot) => setPicker({ slot, sidearm: true })}
          />
        </div>
      </div>

      {picker && (() => {
        const wpn = picker.sidearm
          ? getWeapon(unit.loadout!.sidearmId)
          : getWeapon(unit.loadout!.primaryId);
        if (!wpn) return null;
        const cur = (picker.sidearm
          ? unit.loadout!.sidearmMods
          : unit.loadout!.primaryMods)[picker.slot] ?? null;
        return (
          <ModPicker
            slot={picker.slot}
            weaponClass={wpn.class}
            currentModId={cur}
            onPick={(modId) => onPickMod(picker.slot, picker.sidearm, modId)}
            onClose={() => setPicker(null)}
            title={`Refit · ${picker.sidearm ? 'Sidearm' : 'Primary'} · ${picker.slot}`}
          />
        );
      })()}
    </>
  );
}

function RefitWeaponPanel({ name, subtitle, slots, slotMap, disabled, onSlotClick }: {
  name: string; subtitle: string; slots: ModSlot[];
  slotMap: Partial<Record<ModSlot, string>>;
  disabled: boolean;
  onSlotClick: (slot: ModSlot) => void;
}) {
  return (
    <div className="stack" style={{ gap: 'var(--s-2)' }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <strong>{name}</strong>
        <span style={{ fontSize: 11, color: 'var(--fg-2)', textTransform: 'uppercase' }}>{subtitle}</span>
      </div>
      <div className="row" style={{ gap: 'var(--s-2)', flexWrap: 'wrap' }}>
        {slots.map((slot) => {
          const id = slotMap[slot];
          const mod = id ? getMod(id) : null;
          return (
            <button
              key={slot}
              onClick={() => onSlotClick(slot)}
              disabled={disabled}
              style={{
                flex: '1 1 130px', minHeight: 56, padding: 'var(--s-2)',
                display: 'block', textAlign: 'left',
                borderColor: mod ? 'var(--accent)' : 'var(--bg-3)',
                background: mod ? 'var(--bg-3)' : 'var(--bg-2)',
                borderStyle: mod ? 'solid' : 'dashed',
              }}
            >
              <div style={{
                fontSize: 10, color: 'var(--fg-2)',
                textTransform: 'uppercase', letterSpacing: 0.6,
              }}>
                {slot}
              </div>
              <div style={{
                fontSize: 13, color: mod ? 'var(--fg-0)' : 'var(--fg-2)', marginTop: 2,
              }}>
                {mod?.name ?? `+ Add ${slot}`}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

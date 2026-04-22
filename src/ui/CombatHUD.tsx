import { useState } from 'react';
import { useCombatStore } from '../state/combatStore';
import { useContent, getWeapon, getMod } from '../content/registry';
import { SIDEARM_MOD_SLOTS } from '../game/types';
import type { ModSlot } from '../game/types';
import ModPicker from './components/ModPicker';

const PRIMARY_SLOTS: ModSlot[] = ['optic', 'magazine', 'muzzle', 'stock'];

export default function CombatHUD() {
  const phase = useCombatStore((s) => s.phase);
  const round = useCombatStore((s) => s.round);
  const units = useCombatStore((s) => s.units);
  const objective = useCombatStore((s) => s.objective);
  const selectedId = useCombatStore((s) => s.selectedId);
  const mode = useCombatStore((s) => s.mode);
  const selectedUtilityIdx = useCombatStore((s) => s.selectedUtilityIdx);
  const pendingShotTargetId = useCombatStore((s) => s.pendingShotTargetId);
  const pendingShotUsesSidearm = useCombatStore((s) => s.pendingShotUsesSidearm);
  const pendingUtility = useCombatStore((s) => s.pendingUtility);
  const log = useCombatStore((s) => s.log);
  const setMode = useCombatStore((s) => s.setMode);
  const tryReload = useCombatStore((s) => s.tryReload);
  const toggleOverwatch = useCombatStore((s) => s.toggleOverwatch);
  const tryRefit = useCombatStore((s) => s.tryRefit);
  const tryMysticArcaneSight = useCombatStore((s) => s.tryMysticArcaneSight);
  const endPlayerTurn = useCombatStore((s) => s.endPlayerTurn);
  const selectUnit = useCombatStore((s) => s.selectUnit);
  const confirmPending = useCombatStore((s) => s.confirmPending);
  const cancelPending = useCombatStore((s) => s.cancelPending);
  const getShotPreview = useCombatStore((s) => s.getShotPreview);

  // Field Refit panel state lives in the HUD (not the store) — it's UI-only.
  const [refitOpen, setRefitOpen] = useState(false);
  const [refitPicker, setRefitPicker] = useState<{ slot: ModSlot; sidearm: boolean } | null>(null);

  const selected = units.find((u) => u.id === selectedId);
  const playerUnits = units.filter((u) => u.faction === 'player');
  const primary = selected?.loadout ? getWeapon(selected.loadout.primaryId) : null;
  const sidearm = selected?.loadout ? getWeapon(selected.loadout.sidearmId) : null;
  const kit = selected?.loadout?.kitId ? useContent().kits[selected.loadout.kitId] ?? null : null;
  // Magazine caps include any Kit bonus ammo so Reload disables correctly.
  const primaryCap = (primary?.ammo ?? 0) + (kit?.effects.extraAmmoPrimary ?? 0);
  const sidearmCap = (sidearm?.ammo ?? 0) + (kit?.effects.extraAmmoSidearm ?? 0);
  const disabled = phase !== 'player' || !selected || !selected.alive;

  const shotPreview = pendingShotTargetId !== null
    ? getShotPreview(pendingShotTargetId, pendingShotUsesSidearm) : null;
  const shotTarget = pendingShotTargetId !== null
    ? units.find((u) => u.id === pendingShotTargetId) : null;
  const pendingUtilityDef = (pendingUtility && selected?.loadout)
    ? useContent().utilities[selected.loadout.utilityIds[pendingUtility.idx]]
    : null;

  return (
    <>
      {/* Top status */}
      <div style={{ position: 'fixed', top: 'calc(var(--safe-top) + var(--s-2))', left: 'var(--s-2)', right: 'var(--s-2)', display: 'flex', gap: 'var(--s-2)', pointerEvents: 'none', zIndex: 10 }}>
        <div className="panel stack" style={{ padding: '6px 10px', fontSize: 13, pointerEvents: 'auto', gap: 2 }}>
          <div>
            <strong>Round {round}</strong> · {phase === 'player' ? 'Your turn' : phase === 'enemy' ? 'Enemy turn' : phase === 'won' ? 'Victory' : 'Defeat'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
            {objectiveLabel(objective, units, useCombatStore.getState().defendTurns)}
          </div>
        </div>
        <div className="panel scroll-x" style={{ padding: 6, flex: 1, display: 'flex', gap: 6, pointerEvents: 'auto' }}>
          {playerUnits.map((u) => (
            <button key={u.id} onClick={() => selectUnit(u.id)}
              style={{
                minHeight: 44, minWidth: 72, padding: 6,
                border: `1px solid ${u.id === selectedId ? 'var(--accent)' : 'var(--bg-3)'}`,
                background: u.alive ? (u.id === selectedId ? 'var(--bg-3)' : 'var(--bg-2)') : '#2a1a1a',
                opacity: u.alive ? 1 : 0.5, display: 'block', textAlign: 'left',
              }}>
              <div style={{ fontSize: 11, color: u.color, fontWeight: 600 }}>{u.name}</div>
              <div style={{ fontSize: 11, color: 'var(--fg-1)' }}>{u.hp}/{u.hpMax} · AP {u.ap}/{u.apMax}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Log */}
      <div className="panel scroll-y" style={{
        position: 'fixed', right: 'var(--s-2)',
        top: 'calc(var(--safe-top) + 72px)',
        width: 220, maxHeight: 140, fontSize: 12, pointerEvents: 'auto',
        display: 'flex', flexDirection: 'column-reverse', zIndex: 10,
      }}>
        <div>
          {log.slice(-10).map((l) => (
            <div key={l.id} style={{ color: logColor(l.kind), marginBottom: 2 }}>{l.text}</div>
          ))}
        </div>
      </div>

      {/* Shot preview card with hit-modifier breakdown */}
      {shotPreview && shotTarget && (
        <div className="panel" style={{
          position: 'fixed', left: '50%', transform: 'translateX(-50%)',
          bottom: 'calc(var(--safe-bottom) + 92px)', zIndex: 11,
          minWidth: 260, maxWidth: 320, padding: 'var(--s-3)', pointerEvents: 'auto',
          borderColor: 'var(--danger)',
        }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
            <strong style={{ color: 'var(--fg-0)' }}>
              {pendingShotUsesSidearm ? '🔫 Sidearm' : 'Target'}: {shotTarget.name}
            </strong>
            <span style={{ fontSize: 12, color: coverColor(shotPreview.cover) }}>
              {shotPreview.cover === 'none' ? 'flanked' : `${shotPreview.cover} cover`}
            </span>
          </div>
          <div className="row" style={{ gap: 'var(--s-4)', fontSize: 14, marginBottom: 6 }}>
            <span><span style={{ color: 'var(--fg-2)' }}>hit</span> <strong>{shotPreview.hitChance}%</strong></span>
            <span><span style={{ color: 'var(--fg-2)' }}>crit</span> <strong>{shotPreview.critChance}%</strong></span>
            <span><span style={{ color: 'var(--fg-2)' }}>dmg</span> <strong>{shotPreview.dmgMin}–{shotPreview.dmgMax}</strong></span>
          </div>
          {/* Modifier breakdown */}
          <div style={{ fontSize: 11, color: 'var(--fg-2)', marginBottom: 8,
            borderTop: '1px solid var(--bg-3)', paddingTop: 6 }}>
            {shotPreview.modifiers.map((m, i) => (
              <span key={i} style={{ marginRight: 8 }}>
                <span style={{ color: m.value < 0 ? 'var(--danger)' : m.value > 0 ? 'var(--success)' : 'var(--fg-2)' }}>
                  {m.value > 0 ? '+' : ''}{m.value}
                </span> {m.label}
              </span>
            ))}
          </div>
          <div className="row" style={{ gap: 'var(--s-2)' }}>
            <button style={{ flex: 1 }} onClick={cancelPending}>Cancel</button>
            <button className="primary" style={{ flex: 1 }} onClick={confirmPending}>
              {pendingShotUsesSidearm ? 'Pistol' : 'Fire'}
            </button>
          </div>
        </div>
      )}

      {/* Utility preview card */}
      {pendingUtility && pendingUtilityDef && (
        <div className="panel" style={{
          position: 'fixed', left: '50%', transform: 'translateX(-50%)',
          bottom: 'calc(var(--safe-bottom) + 92px)', zIndex: 11,
          minWidth: 240, padding: 'var(--s-3)', pointerEvents: 'auto',
          borderColor: 'var(--accent-2)',
        }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
            <strong>{pendingUtilityDef.name}</strong>
            <span style={{ fontSize: 12, color: 'var(--accent-2)' }}>radius {pendingUtilityDef.radius}</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--fg-1)', marginBottom: 8 }}>
            {pendingUtilityDef.dmgMin !== undefined
              ? `${pendingUtilityDef.dmgMin}–${pendingUtilityDef.dmgMax} dmg in radius`
              : pendingUtilityDef.kind === 'smoke'
                ? `Drops smoke that blocks line of sight for 2 rounds`
                : pendingUtilityDef.heal
                  ? `Heals ${pendingUtilityDef.heal} to adjacent ally`
                  : `Applies ${pendingUtilityDef.kind}`}
          </div>
          <div className="row" style={{ gap: 'var(--s-2)' }}>
            <button style={{ flex: 1 }} onClick={cancelPending}>Cancel</button>
            <button className="primary" style={{ flex: 1 }} onClick={confirmPending}>Throw</button>
          </div>
        </div>
      )}

      {/* Bottom action bar — fixed so it stays above the mobile URL bar. */}
      <div style={{
        position: 'fixed', bottom: 'calc(var(--safe-bottom) + var(--s-2))',
        left: 'var(--s-2)', right: 'var(--s-2)', zIndex: 10,
        display: 'flex', gap: 'var(--s-2)', flexWrap: 'wrap',
        background: 'rgba(11,15,20,0.85)', border: '1px solid var(--bg-3)', borderRadius: 'var(--r-lg)',
        padding: 'var(--s-2)', backdropFilter: 'blur(6px)',
      }}>
        <button onClick={() => setMode(mode === 'move' ? 'idle' : 'move')} disabled={disabled}
          style={{ borderColor: mode === 'move' ? 'var(--accent)' : undefined }}>Move</button>
        <button onClick={() => setMode(mode === 'fire' ? 'idle' : 'fire')}
          disabled={disabled || !primary || (selected!.ap < primary.apCost) || selected!.ammo <= 0}
          style={{ borderColor: mode === 'fire' ? 'var(--accent)' : undefined }}>
          Fire {primary ? `(${selected!.ammo}/${primaryCap})` : ''}
        </button>
        <button onClick={() => setMode(mode === 'sidearm' ? 'idle' : 'sidearm')}
          disabled={disabled || !sidearm || (selected!.ap < sidearm.apCost) || selected!.sidearmAmmo <= 0}
          style={{ borderColor: mode === 'sidearm' ? 'var(--accent)' : undefined }}>
          Sidearm {sidearm ? `(${selected!.sidearmAmmo}/${sidearmCap})` : ''}
        </button>
        {selected?.loadout?.utilityIds.map((uid, i) => {
          const u = useContent().utilities[uid]!;
          const active = mode === 'utility' && selectedUtilityIdx === i;
          const charges = selected.utilityCharges[i] ?? 0;
          return (
            <button key={i} onClick={() => setMode(active ? 'idle' : 'utility', active ? undefined : i)}
              disabled={disabled || selected!.ap < u.apCost || charges <= 0}
              style={{ borderColor: active ? 'var(--accent)' : undefined }}>
              {u.name} ×{charges}
            </button>
          );
        })}
        <button onClick={() => tryReload()}
          disabled={disabled || !primary
            || (selected!.ammo >= primaryCap && selected!.sidearmAmmo >= sidearmCap)}>Reload</button>
        <button onClick={() => toggleOverwatch()} disabled={disabled || selected!.ap < 1}
          style={{ borderColor: selected?.status.overwatch ? 'var(--accent)' : undefined }}>
          {selected?.status.overwatch ? 'Cancel OW' : 'Overwatch'}
        </button>
        <button onClick={() => setRefitOpen(true)}
          disabled={disabled || selected!.ap < 1 || selected!.status.overwatch}>
          Refit
        </button>
        {selected?.loadout && (() => {
          // Class abilities surface per-class:
          //   Ranger  → Mark (target enemy in ability mode)
          //   Warden  → Bracing Fire (target enemy, heavy only, costs ammo)
          //   Mystic  → Arcane Sight (instant self-cast)
          //   Sapper  → Demolish (target cover tile in ability mode)
          const tmpl = useContent().soldierTemplates[selected.templateId];
          if (!tmpl) return null;
          const primary = getWeapon(selected.loadout.primaryId);
          const apOK = selected.ap >= 1;
          let label: string, canUse: boolean, onClick: () => void;
          switch (tmpl.class) {
            case 'Ranger':
              label = 'Mark';
              canUse = apOK && !disabled;
              onClick = () => setMode(mode === 'ability' ? 'idle' : 'ability');
              break;
            case 'Warden':
              label = 'Bracing Fire';
              canUse = apOK && !disabled && primary.class === 'heavy' && selected.ammo > 0;
              onClick = () => setMode(mode === 'ability' ? 'idle' : 'ability');
              break;
            case 'Mystic':
              label = selected.status.seeThroughSmoke ? 'Sight Active' : 'Arcane Sight';
              canUse = apOK && !disabled && !selected.status.seeThroughSmoke;
              onClick = () => tryMysticArcaneSight();
              break;
            case 'Sapper':
              label = 'Demolish';
              canUse = apOK && !disabled;
              onClick = () => setMode(mode === 'ability' ? 'idle' : 'ability');
              break;
            default:
              return null;
          }
          return (
            <button onClick={onClick} disabled={!canUse}
              style={{ borderColor: mode === 'ability' ? 'var(--accent)' : undefined }}>
              {label}
            </button>
          );
        })()}
        <div style={{ flex: 1 }} />
        <button className="primary" onClick={() => endPlayerTurn()} disabled={phase !== 'player'}>End Turn</button>
      </div>

      {/* Refit overlay */}
      {refitOpen && selected?.loadout && (() => {
        const p = getWeapon(selected.loadout.primaryId);
        const s = getWeapon(selected.loadout.sidearmId);
        return (
          <div onClick={() => setRefitOpen(false)} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--s-3)',
          }}>
            <div onClick={(e) => e.stopPropagation()} className="panel stack" style={{
              maxWidth: 380, width: '100%', padding: 'var(--s-3)', gap: 'var(--s-3)',
              maxHeight: '88vh', overflowY: 'auto',
            }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: 18 }}>Field Refit · {selected.name}</h2>
                <button onClick={() => setRefitOpen(false)}>Done</button>
              </div>
              <p style={{ fontSize: 12 }}>
                Each swap costs <strong>1 AP</strong>. Current AP: <strong>{selected.ap}/{selected.apMax}</strong>.
              </p>

              <RefitWeaponPanel name={p?.name ?? 'Primary'} subtitle={p?.class ?? ''}
                slots={PRIMARY_SLOTS} slotMap={selected.loadout.primaryMods}
                disabled={selected.ap < 1}
                onSlotClick={(slot) => setRefitPicker({ slot, sidearm: false })} />
              <RefitWeaponPanel name={s?.name ?? 'Sidearm'} subtitle={s?.class ?? ''}
                slots={SIDEARM_MOD_SLOTS} slotMap={selected.loadout.sidearmMods}
                disabled={selected.ap < 1}
                onSlotClick={(slot) => setRefitPicker({ slot, sidearm: true })} />
            </div>
          </div>
        );
      })()}

      {refitPicker && selected?.loadout && (() => {
        const wpn = refitPicker.sidearm
          ? getWeapon(selected.loadout.sidearmId)
          : getWeapon(selected.loadout.primaryId);
        if (!wpn) return null;
        const cur = (refitPicker.sidearm ? selected.loadout.sidearmMods : selected.loadout.primaryMods)[refitPicker.slot] ?? null;
        return (
          <ModPicker
            slot={refitPicker.slot}
            weaponClass={wpn.class}
            currentModId={cur}
            onPick={(modId) => tryRefit(refitPicker.slot, refitPicker.sidearm, modId)}
            onClose={() => setRefitPicker(null)}
            title={`Refit · ${refitPicker.sidearm ? 'Sidearm' : 'Primary'} · ${refitPicker.slot}`}
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
            <button key={slot} onClick={() => onSlotClick(slot)} disabled={disabled}
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
    </div>
  );
}

function logColor(k: string) {
  switch (k) {
    case 'hit': return 'var(--fg-0)';
    case 'crit': return 'var(--accent-2)';
    case 'miss': return 'var(--fg-2)';
    case 'kill': return 'var(--danger)';
    case 'heal': return 'var(--success)';
    default: return 'var(--fg-1)';
  }
}

function coverColor(c: string) {
  if (c === 'full') return 'var(--accent)';
  if (c === 'half') return 'var(--warn)';
  return 'var(--danger)';
}

/**
 * One-line objective summary for the top-of-screen HUD chip.
 * Includes live progress for the objective kinds that have it (HP of
 * the destructible, rounds held, VIP health + distance to extract).
 */
function objectiveLabel(
  o: import('../game/types').MissionObjective,
  units: import('../game/types').Unit[],
  defendTurns: number,
): string {
  switch (o.kind) {
    case 'eliminate_all':    return 'Objective: eliminate all hostiles';
    case 'eliminate_target': return `Objective: eliminate target`;
    case 'reach_tile':
      return o.turnLimit
        ? `Objective: reach the extraction (${o.turnLimit} rounds)`
        : 'Objective: reach the extraction';
    case 'destroy_objective': {
      const tgt = units.find((u) => u.role === 'objective'
        && u.pos.x === o.pos.x && u.pos.y === o.pos.y);
      if (!tgt || !tgt.alive) return 'Objective: target destroyed';
      return `Objective: destroy the target (${tgt.hp}/${tgt.hpMax} HP)`;
    }
    case 'defend_point':
      return `Objective: hold the point (${defendTurns}/${o.turns} rounds)`;
    case 'extract_vip': {
      const vip = units.find((u) => u.role === 'vip');
      if (!vip) return 'Objective: extract the VIP';
      if (!vip.alive) return 'Objective: VIP lost';
      const d = Math.abs(vip.pos.x - o.extractTile.x) + Math.abs(vip.pos.y - o.extractTile.y);
      return `Objective: extract VIP (HP ${vip.hp}/${vip.hpMax}, ${d} tiles to exit)`;
    }
  }
}

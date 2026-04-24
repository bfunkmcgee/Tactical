import { useGameStore } from '../state/gameStore';
import SoldierPortrait from './SoldierPortrait';
import type { SoldierTemplate } from '../game/types';

/**
 * Player-facing barracks modal — manages the per-pack pool of custom
 * soldiers created via the character-creation flow. Lists every entry
 * in gameStore.customSoldiers with a portrait + class + delete button.
 *
 * Pack-default soldiers (Kestrel, Brannock, Vex, etc.) never appear
 * here — they're not deletable. The only mutation this screen drives
 * is `removeCustomSoldier`, which in turn:
 *   - drops the template from customSoldiers
 *   - drops its loadout
 *   - replaces the id in the roster with the active pack's first
 *     default soldier (see gameStore.removeCustomSoldier)
 *
 * Kept narrow on purpose. A richer barracks (rename, stat reset,
 * cross-pack transfer) is future work; this solves the "create + then
 * what?" gap players hit after confirming their first custom soldier.
 */
export interface BarracksScreenProps {
  onClose: () => void;
}

export default function BarracksScreen({ onClose }: BarracksScreenProps) {
  const customSoldiers = useGameStore((s) => s.customSoldiers);
  const removeCustomSoldier = useGameStore((s) => s.removeCustomSoldier);
  const roster = useGameStore((s) => s.roster);

  const entries: SoldierTemplate[] = Object.values(customSoldiers);
  const inRoster = (id: string) => roster.includes(id);

  function handleDelete(tpl: SoldierTemplate): void {
    // Confirm before dropping — especially if the soldier is in the
    // current roster, because deletion auto-swaps them for the pack
    // default and wipes their loadout.
    const inUse = inRoster(tpl.id);
    const warning = inUse
      ? `${tpl.name} is in your active roster. Deleting will replace their slot with the pack default. Continue?`
      : `Delete ${tpl.name}? This can't be undone.`;
    if (typeof window !== 'undefined' && !window.confirm(warning)) return;
    removeCustomSoldier(tpl.id);
  }

  return (
    <div
      className="stack"
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(6, 10, 14, 0.86)',
        zIndex: 100,
        padding: 'var(--s-3)',
        gap: 'var(--s-3)',
        overflow: 'auto',
      }}
    >
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button onClick={onClose}>Back</button>
        <h2>Barracks</h2>
        <span style={{ color: 'var(--fg-2)', fontSize: 13 }}>
          {entries.length} custom soldier{entries.length === 1 ? '' : 's'}
        </span>
      </div>

      {entries.length === 0 ? (
        <div className="panel stack" style={{ padding: 'var(--s-4)', alignItems: 'center', gap: 'var(--s-2)' }}>
          <div style={{ fontSize: 14, color: 'var(--fg-1)' }}>No custom soldiers yet.</div>
          <div style={{ fontSize: 12, color: 'var(--fg-2)' }}>
            Use <strong>+ Create Soldier</strong> on the loadout screen to make one.
          </div>
        </div>
      ) : (
        <div
          className="stack"
          style={{ gap: 'var(--s-2)' }}
        >
          {entries.map((tpl) => (
            <div
              key={tpl.id}
              className="panel row"
              style={{
                gap: 'var(--s-3)',
                alignItems: 'center',
                padding: 'var(--s-2)',
              }}
            >
              <SoldierPortrait template={tpl} size={48} />
              <div className="stack" style={{ flex: 1, gap: 2 }}>
                <strong>{tpl.name}</strong>
                <div style={{ fontSize: 11, color: 'var(--fg-2)' }}>
                  {tpl.class}
                  {inRoster(tpl.id) && (
                    <span style={{ marginLeft: 'var(--s-2)', color: 'var(--accent)' }}>
                      · in roster
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--fg-2)' }}>
                  HP {tpl.hpMax} · Aim {tpl.aim >= 0 ? '+' : ''}{tpl.aim} · Move {tpl.mobility}
                </div>
              </div>
              <button
                onClick={() => handleDelete(tpl)}
                style={{ color: 'var(--danger, #d26a6a)' }}
                title="Remove this custom soldier"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

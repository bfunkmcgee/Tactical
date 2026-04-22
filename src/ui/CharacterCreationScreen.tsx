import { useMemo, useState } from 'react';
import { useContent, allKits, getSoldierTemplate } from '../content/registry';
import { SKIN_TONES, HAIR_COLORS, EYE_COLORS } from '../content/rigs/palettes';
import type { HumanAppearance, SoldierClass, SoldierTemplate } from '../game/types';
import RigPreview from './RigPreview';

/**
 * Player-facing character creation modal. Opens from LoadoutScreen via
 * a "Create Soldier" button. Player picks name + class + kit + palette;
 * the preview pane re-composes the rig live as selections change. On
 * confirm, the composed `SoldierTemplate` is handed to the caller via
 * `onCreate` (typically gameStore.addCustomSoldier).
 *
 * Classes restricted to the four existing Eagle Corps classes per the
 * plan — new classes are pack content, not player-UI content. Stats
 * mirror the class archetype (Kestrel's stats for a custom Ranger,
 * Brannock's for a Warden, etc.). The player chooses identity +
 * aesthetics; gameplay parameters ride on the class they picked.
 */

export interface CharacterCreationScreenProps {
  onCreate: (tpl: SoldierTemplate) => void;
  onCancel: () => void;
}

/** Soldier-id per class used to source stat baselines + default loadout.
 *  Maps to the four Eagle Corps heroes (ranger_kestrel, etc.) which
 *  exist in every pack via the defaultRoster + default loadout. */
const CLASS_ARCHETYPE: Record<SoldierClass, string> = {
  Ranger: 'ranger_kestrel',
  Warden: 'warden_brannock',
  Mystic: 'mystic_seraphine',
  Sapper: 'sapper_orin',
};

const CLASSES: SoldierClass[] = ['Ranger', 'Warden', 'Mystic', 'Sapper'];

/** Stable UUID-ish id generator. crypto.randomUUID on modern browsers;
 *  fallback for older environments (tests, older build targets). */
function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `custom_${(crypto as Crypto).randomUUID()}`;
  }
  return `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function CharacterCreationScreen({
  onCreate, onCancel,
}: CharacterCreationScreenProps) {
  const pack = useContent();
  const hairStyleIds = useMemo(
    () => (pack.hairStyles ? Object.keys(pack.hairStyles) : []),
    [pack],
  );
  const baseOutfitIds = useMemo(
    () => (pack.baseOutfits ? Object.keys(pack.baseOutfits) : []),
    [pack],
  );

  const [name, setName] = useState<string>('Recruit');
  const [cls, setCls] = useState<SoldierClass>('Ranger');
  const [kitId, setKitId] = useState<string | null>(null);
  const [skinTone, setSkinTone] = useState<number>(SKIN_TONES[1].color);
  const [hairStyle, setHairStyle] = useState<string>(hairStyleIds[0] ?? 'bald');
  const [hairColor, setHairColor] = useState<number>(HAIR_COLORS[1].color);
  const [eyeColor, setEyeColor] = useState<number>(EYE_COLORS[0].color);
  const [baseOutfit, setBaseOutfit] = useState<string>(baseOutfitIds[0] ?? 'fatigues');

  // Live-computed HumanAppearance used by the preview.
  const appearance: HumanAppearance = useMemo(() => ({
    rig: 'human',
    skinTone,
    hairStyle,
    hairColor,
    eyeColor,
    baseOutfit,
  }), [skinTone, hairStyle, hairColor, eyeColor, baseOutfit]);

  const archetype = useMemo(() => getSoldierTemplate(CLASS_ARCHETYPE[cls]), [cls]);

  // Default kit for the archetype class — used when the player hasn't
  // actively picked a kit. null means "same as the class archetype's
  // default loadout".
  const effectiveKitId = kitId ?? archetype.defaultLoadout.kitId;

  const canCreate = name.trim().length > 0;

  function handleCreate(): void {
    const tpl: SoldierTemplate = {
      id: newId(),
      name: name.trim(),
      class: cls,
      // Stats mirror the class archetype — one point of divergence we
      // could adjust later via a point-buy UI (deferred per plan).
      hpMax: archetype.hpMax,
      aim: archetype.aim,
      mobility: archetype.mobility,
      // Portrait color: the chosen skin tone doubles as the portrait
      // swatch in LoadoutScreen's roster picker. Simple heuristic;
      // a future polish pass can render a head-only rig thumbnail.
      portraitColor: '#' + skinTone.toString(16).padStart(6, '0'),
      defaultLoadout: {
        ...archetype.defaultLoadout,
        kitId: effectiveKitId,
      },
      appearance,
    };
    onCreate(tpl);
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
        <button onClick={onCancel}>Cancel</button>
        <h2>Create Soldier</h2>
        <button
          className="primary"
          disabled={!canCreate}
          onClick={handleCreate}
        >
          Create
        </button>
      </div>

      <div className="row" style={{ gap: 'var(--s-3)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Live preview */}
        <div className="panel stack" style={{ gap: 'var(--s-2)', flexShrink: 0 }}>
          <RigPreview appearance={appearance} />
          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--fg-2)' }}>
            Live preview
          </div>
        </div>

        {/* Pickers */}
        <div className="stack" style={{ flex: 1, gap: 'var(--s-3)', minWidth: 280 }}>
          <div className="panel stack" style={{ gap: 'var(--s-2)' }}>
            <label style={{ fontSize: 13, color: 'var(--fg-2)' }}>Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 20))}
              style={{
                padding: 'var(--s-2)',
                background: 'var(--bg-2)',
                color: 'var(--fg-0)',
                border: '1px solid var(--bg-3)',
                borderRadius: 'var(--r-md)',
              }}
            />
          </div>

          <div className="panel stack" style={{ gap: 'var(--s-2)' }}>
            <label style={{ fontSize: 13, color: 'var(--fg-2)' }}>Class</label>
            <div className="row" style={{ gap: 'var(--s-2)', flexWrap: 'wrap' }}>
              {CLASSES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCls(c)}
                  style={{
                    flex: '1 1 auto',
                    borderColor: cls === c ? 'var(--accent)' : 'var(--bg-3)',
                    background: cls === c ? 'var(--bg-3)' : 'var(--bg-2)',
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="panel stack" style={{ gap: 'var(--s-2)' }}>
            <label style={{ fontSize: 13, color: 'var(--fg-2)' }}>Kit</label>
            <select
              value={kitId ?? (archetype.defaultLoadout.kitId ?? '')}
              onChange={(e) => setKitId(e.target.value || null)}
              style={{
                padding: 'var(--s-2)',
                background: 'var(--bg-2)',
                color: 'var(--fg-0)',
                border: '1px solid var(--bg-3)',
                borderRadius: 'var(--r-md)',
              }}
            >
              <option value="">— No kit —</option>
              {allKits().map((k) => (
                <option key={k.id} value={k.id}>{k.name}</option>
              ))}
            </select>
          </div>

          <SwatchPicker
            label="Skin"
            swatches={SKIN_TONES}
            selected={skinTone}
            onPick={setSkinTone}
          />
          <CyclePicker
            label="Hair Style"
            options={hairStyleIds.map((id) => ({
              id, name: pack.hairStyles?.[id]?.name ?? id,
            }))}
            selected={hairStyle}
            onPick={setHairStyle}
          />
          <SwatchPicker
            label="Hair Color"
            swatches={HAIR_COLORS}
            selected={hairColor}
            onPick={setHairColor}
          />
          <SwatchPicker
            label="Eyes"
            swatches={EYE_COLORS}
            selected={eyeColor}
            onPick={setEyeColor}
          />
          <CyclePicker
            label="Base Outfit"
            options={baseOutfitIds.map((id) => ({
              id, name: pack.baseOutfits?.[id]?.name ?? id,
            }))}
            selected={baseOutfit}
            onPick={setBaseOutfit}
          />
        </div>
      </div>
    </div>
  );
}

function SwatchPicker({
  label, swatches, selected, onPick,
}: {
  label: string;
  swatches: readonly { id: string; name: string; color: number }[];
  selected: number;
  onPick: (color: number) => void;
}) {
  return (
    <div className="panel stack" style={{ gap: 'var(--s-2)' }}>
      <label style={{ fontSize: 13, color: 'var(--fg-2)' }}>{label}</label>
      <div className="row" style={{ gap: 'var(--s-2)', flexWrap: 'wrap' }}>
        {swatches.map((s) => (
          <button
            key={s.id}
            onClick={() => onPick(s.color)}
            title={s.name}
            aria-label={s.name}
            style={{
              width: 36, height: 36, padding: 0,
              background: '#' + s.color.toString(16).padStart(6, '0'),
              borderRadius: '50%',
              border: selected === s.color
                ? '3px solid var(--accent)'
                : '2px solid var(--bg-3)',
              cursor: 'pointer',
            }}
          />
        ))}
      </div>
    </div>
  );
}

function CyclePicker({
  label, options, selected, onPick,
}: {
  label: string;
  options: { id: string; name: string }[];
  selected: string;
  onPick: (id: string) => void;
}) {
  if (options.length === 0) {
    return (
      <div className="panel stack" style={{ gap: 'var(--s-2)' }}>
        <label style={{ fontSize: 13, color: 'var(--fg-2)' }}>{label}</label>
        <div style={{ fontSize: 13, color: 'var(--fg-2)' }}>
          (no options in this pack)
        </div>
      </div>
    );
  }
  const idx = Math.max(0, options.findIndex((o) => o.id === selected));
  const step = (d: number) => onPick(options[(idx + d + options.length) % options.length].id);
  return (
    <div className="panel stack" style={{ gap: 'var(--s-2)' }}>
      <label style={{ fontSize: 13, color: 'var(--fg-2)' }}>{label}</label>
      <div className="row" style={{ gap: 'var(--s-2)', alignItems: 'center' }}>
        <button onClick={() => step(-1)} aria-label="Previous">◀</button>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 14 }}>
          {options[idx]?.name ?? '—'}
        </div>
        <button onClick={() => step(1)} aria-label="Next">▶</button>
      </div>
    </div>
  );
}

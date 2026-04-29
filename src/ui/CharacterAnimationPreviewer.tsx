import { useEffect, useMemo, useRef, useState } from 'react';
import { Application, Container } from 'pixi.js';
import { useGameStore } from '../state/gameStore';
import {
  allEnemyTemplates, allSoldierTemplates, allWeapons, useContent,
} from '../content/registry';
import {
  type UnitNode,
  createUnitNode,
  ensureSpritesLoaded,
} from '../game/rendering/units/UnitNode';
import { tickUnitAnimations } from '../game/rendering/units/animate';
import { HIT_FLASH_MS, MOVE_TWEEN_MS } from '../game/rendering/units/constants';
import type { EnemyTemplate, SoldierTemplate, Unit, Weapon } from '../game/types';
import {
  applyPreviewWeaponClass,
  resolvePreviewWeaponClass,
  type PreviewWeaponContext,
} from './previewer/weaponPreviewContext';
import { makePreviewUnit } from './previewer/makePreviewUnit';

/**
 * Dev-only character + animation previewer. Mounts a Pixi
 * Application + ticker, builds a synthetic Unit from the picked
 * template + weapon, runs the live `tickUnitAnimations` loop. Lets
 * a developer trigger Walk / Fire / Hit / Death / Idle without
 * deploying a mission. Reuses the live UnitNode rendering pipeline
 * verbatim so the previewer reflects exactly what the player sees in
 * combat.
 *
 * Gated behind a `?dev=1` URL param at the menu so it doesn't ship
 * to normal players.
 */
export default function CharacterAnimationPreviewer() {
  const setScreen = useGameStore((s) => s.setScreen);
  const pack = useContent();

  const soldierTemplates = useMemo(() => allSoldierTemplates(), [pack]);
  const enemyTemplates = useMemo(() => allEnemyTemplates(), [pack]);
  const weapons = useMemo(() => allWeapons(), [pack]);
  const primaries = useMemo(() => weapons.filter((w) => w.slot === 'primary'), [weapons]);
  const sidearms = useMemo(() => weapons.filter((w) => w.slot === 'sidearm'), [weapons]);

  // Pickers — local state, no store roundtrip.
  const [templateId, setTemplateId] = useState<string>(soldierTemplates[0]?.id ?? '');
  const [primaryId, setPrimaryId] = useState<string>(primaries[0]?.id ?? '');
  const [sidearmId, setSidearmId] = useState<string>(sidearms[0]?.id ?? '');
  const [facing, setFacing] = useState<1 | -1>(1);
  const [walkLoop, setWalkLoop] = useState<boolean>(false);
  const [phase, setPhase] = useState<string>('idle');
  const [fireContext, setFireContext] = useState<PreviewWeaponContext>('primary');

  // Pixi mount refs.
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const layerRef = useRef<Container | null>(null);
  const nodeRef = useRef<UnitNode | null>(null);
  const nodesMapRef = useRef<Map<number, UnitNode>>(new Map());
  // Refs the ticker reads each frame so picker changes apply without
  // tearing down the ticker loop itself.
  const facingRef = useRef<1 | -1>(facing);
  const walkLoopRef = useRef<boolean>(walkLoop);
  const walkSwingRef = useRef<1 | -1>(1);
  // Throttled phase string updates (10 Hz) so React re-renders don't
  // fire on every Pixi frame.
  const lastPhaseUpdateRef = useRef<number>(0);

  useEffect(() => { facingRef.current = facing; }, [facing]);
  useEffect(() => { walkLoopRef.current = walkLoop; }, [walkLoop]);

  // ---- Mount once: Pixi app + sprite preload + ticker.
  useEffect(() => {
    const host = hostRef.current!;
    const app = new Application();
    let destroyed = false;

    (async () => {
      await app.init({
        resizeTo: host,
        background: '#0e1a20',
        antialias: true,
        resolution: Math.min(window.devicePixelRatio, 2),
        autoDensity: true,
      });
      if (destroyed) { app.destroy(true); return; }
      host.appendChild(app.canvas);
      appRef.current = app;

      // Preload everything PixiStage preloads — rig parts, weapons,
      // armor overlays, outfits, hair, painted floors, partOverrides.
      // The previewer needs all of this so the picked unit composes
      // with full fidelity on the first build.
      await ensureSpritesLoaded(useContent());
      if (destroyed) return;

      const layer = new Container();
      // Centre the unit in the canvas. Game iso projection isn't used
      // here — we just want the unit visible at the canvas centre.
      const recentre = () => {
        layer.position.set(app.screen.width / 2, app.screen.height * 0.65);
      };
      recentre();
      app.stage.addChild(layer);
      layerRef.current = layer;
      app.renderer.on('resize', recentre);

      // Build the initial node from current pickers.
      buildNodeFromPickers();

      app.ticker.add((ticker) => {
        const dtMs = ticker.deltaMS;
        const node = nodeRef.current;
        const layer = layerRef.current;
        if (!node || !layer) return;

        // Auto-loop walk: when the prior tween finishes, start
        // another in the opposite direction so the unit ping-pongs.
        if (walkLoopRef.current && node.moveDurationMs === 0) {
          const swing = walkSwingRef.current;
          node.currentScreen = {
            x: node.container.position.x,
            y: node.container.position.y,
          };
          node.targetScreen = {
            x: node.container.position.x + swing * 40,
            y: node.container.position.y,
          };
          node.moveMs = 0;
          node.moveDurationMs = MOVE_TWEEN_MS;
          node.facing = swing > 0 ? 1 : -1;
          walkSwingRef.current = (swing === 1 ? -1 : 1);
        }

        tickUnitAnimations(layer, nodesMapRef.current, dtMs, performance.now());

        // Status string — throttled to 10 Hz.
        const now = performance.now();
        if (now - lastPhaseUpdateRef.current > 100) {
          lastPhaseUpdateRef.current = now;
          setPhase(describePhase(node));
        }
      });
    })();

    return () => {
      destroyed = true;
      try { app.destroy(true); } catch { /* ignore */ }
      appRef.current = null;
      layerRef.current = null;
      nodeRef.current = null;
      nodesMapRef.current.clear();
    };
    // Mount once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Rebuild the node when any picker changes.
  useEffect(() => {
    if (!appRef.current || !layerRef.current) return;
    buildNodeFromPickers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId, primaryId, sidearmId, fireContext]);

  function buildNodeFromPickers(): void {
    const layer = layerRef.current;
    if (!layer) return;
    // Tear down existing node.
    const old = nodeRef.current;
    if (old) {
      layer.removeChild(old.container);
      old.container.destroy({ children: true });
      nodeRef.current = null;
      nodesMapRef.current.clear();
    }

    const tmpl: SoldierTemplate | EnemyTemplate | undefined =
      pack.soldierTemplates[templateId] ?? pack.enemyTemplates[templateId];
    if (!tmpl) return;

    const isSoldier = 'class' in tmpl;
    const u: Unit = makePreviewUnit({
      template: tmpl,
      primaryId: isSoldier ? primaryId : null,
      sidearmId: isSoldier ? sidearmId : null,
    });

    const node = createUnitNode(u);
    // Set initial fireStyle from the equipped weapon class so Fire
    // triggers immediately use the right choreography. createUnitNode
    // initialises fireStyle to FIRE_STYLES.default; we upgrade.
    const primary = primaryWeaponFor(u, weapons);
    const sidearm = sidearmWeaponFor(u, weapons);
    applyPreviewWeaponClass(node, resolvePreviewWeaponClass({ context: fireContext, primary, sidearm }));
    node.facing = facingRef.current;
    // Reset the container to (0, 0) inside `layer`; layer is centred
    // on the canvas.
    node.container.position.set(0, 0);
    node.currentScreen = { x: 0, y: 0 };
    node.targetScreen = { x: 0, y: 0 };

    layer.addChild(node.container);
    nodeRef.current = node;
    nodesMapRef.current.set(u.id, node);
    walkSwingRef.current = 1;
  }

  // ---- Animation triggers.
  function trigIdle(): void {
    const node = nodeRef.current;
    if (!node) return;
    setWalkLoop(false);
    node.fireAnimMs = 0;
    node.hitFlashMs = 0;
    node.moveDurationMs = 0;
    node.moveMs = 0;
    node.deathMs = null;
    node.container.alpha = 1;
    node.container.position.set(0, 0);
    node.currentScreen = { x: 0, y: 0 };
    node.targetScreen = { x: 0, y: 0 };
    walkSwingRef.current = 1;
  }

  function trigFire(): void {
    const node = nodeRef.current;
    if (!node) return;

    const tmpl: SoldierTemplate | EnemyTemplate | undefined =
      pack.soldierTemplates[templateId] ?? pack.enemyTemplates[templateId];
    const isSoldier = !!tmpl && 'class' in tmpl;
    const primary = isSoldier ? (weapons.find((w) => w.id === primaryId) ?? null) : null;
    const sidearm = isSoldier ? (weapons.find((w) => w.id === sidearmId) ?? null) : null;
    applyPreviewWeaponClass(node, resolvePreviewWeaponClass({ context: fireContext, primary, sidearm }));

    node.fireAnimMs = node.fireStyle.totalMs;
    node.fireTargetDir = { x: facingRef.current, y: 0 };
    node.facing = facingRef.current;
  }

  function trigHit(): void {
    const node = nodeRef.current;
    if (!node) return;
    node.hitFlashMs = HIT_FLASH_MS;
  }

  function trigDeath(): void {
    const node = nodeRef.current;
    if (!node) return;
    node.deathMs = 0;
  }

  function trigReset(): void {
    setWalkLoop(false);
    buildNodeFromPickers();
  }

  function describePhase(n: UnitNode): string {
    if (n.deathMs !== null) {
      return `dying ${n.deathMs.toFixed(0)} ms`;
    }
    if (n.hitFlashMs > 0) {
      return `hit ${(HIT_FLASH_MS - n.hitFlashMs).toFixed(0)} / ${HIT_FLASH_MS} ms`;
    }
    if (n.fireAnimMs > 0) {
      const elapsed = n.fireStyle.totalMs - n.fireAnimMs;
      return `firing ${elapsed.toFixed(0)} / ${n.fireStyle.totalMs} ms`;
    }
    if (n.moveDurationMs > 0) {
      return `walking ${n.moveMs.toFixed(0)} / ${n.moveDurationMs} ms`;
    }
    return 'idle';
  }

  // ---- Render.
  return (
    <div className="screen stack" style={{ gap: 'var(--s-3)', padding: 'var(--s-3)', overflowY: 'auto' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={() => setScreen('menu')}>Back</button>
        <h2>Animation Previewer</h2>
        <span style={{ width: 60 }} />
      </div>

      <div className="row" style={{ gap: 'var(--s-3)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Left: pickers */}
        <div className="panel stack" style={{ gap: 'var(--s-2)', minWidth: 220, flexShrink: 0 }}>
          <label className="stack" style={{ gap: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--fg-2)', textTransform: 'uppercase' }}>Template</span>
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
              <optgroup label="Soldiers">
                {soldierTemplates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </optgroup>
              <optgroup label="Enemies">
                {enemyTemplates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </optgroup>
            </select>
          </label>

          <label className="stack" style={{ gap: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--fg-2)', textTransform: 'uppercase' }}>Primary</span>
            <select
              value={primaryId}
              onChange={(e) => setPrimaryId(e.target.value)}
              disabled={!isSoldierId(templateId, soldierTemplates)}
            >
              {primaries.map((w) => (
                <option key={w.id} value={w.id}>{w.name} · {w.class}</option>
              ))}
            </select>
          </label>

          <label className="stack" style={{ gap: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--fg-2)', textTransform: 'uppercase' }}>Sidearm</span>
            <select
              value={sidearmId}
              onChange={(e) => setSidearmId(e.target.value)}
              disabled={!isSoldierId(templateId, soldierTemplates)}
            >
              {sidearms.map((w) => (
                <option key={w.id} value={w.id}>{w.name} · {w.class}</option>
              ))}
            </select>
          </label>

          <div className="row" style={{ gap: 'var(--s-2)', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--fg-2)', textTransform: 'uppercase' }}>Facing</span>
            <button
              onClick={() => setFacing(-1)}
              style={{ borderColor: facing === -1 ? 'var(--accent)' : undefined }}
            >◀</button>
            <button
              onClick={() => setFacing(1)}
              style={{ borderColor: facing === 1 ? 'var(--accent)' : undefined }}
            >▶</button>
          </div>

          <div style={{
            fontSize: 11, color: 'var(--fg-1)', marginTop: 'var(--s-2)',
            padding: '6px 8px', background: 'var(--bg-2)', borderRadius: 'var(--r-sm)',
            fontFamily: 'monospace',
          }}>
            {phase}
          </div>
        </div>

        {/* Center: triggers + Pixi canvas. Triggers above the canvas so
            they stay visible even when the canvas is tall on mobile. */}
        <div className="stack" style={{ flex: 1, minWidth: 280, gap: 'var(--s-2)' }}>
          <div className="row" style={{ gap: 'var(--s-2)', flexWrap: 'wrap' }}>
            <button onClick={trigIdle}>Idle</button>
            <button
              onClick={() => setWalkLoop((v) => !v)}
              style={{ borderColor: walkLoop ? 'var(--accent)' : undefined }}
            >
              {walkLoop ? 'Walk · on' : 'Walk'}
            </button>
            <button
              onClick={() => setFireContext('primary')}
              style={{ borderColor: fireContext === 'primary' ? 'var(--accent)' : undefined }}
            >Use Primary</button>
            <button
              onClick={() => setFireContext('sidearm')}
              style={{ borderColor: fireContext === 'sidearm' ? 'var(--accent)' : undefined }}
            >Use Sidearm</button>
            <button onClick={trigFire}>Fire</button>
            <button onClick={trigHit}>Hit</button>
            <button onClick={trigDeath}>Death</button>
            <button onClick={trigReset}>Reset</button>
          </div>
          <div
            ref={hostRef}
            style={{
              width: '100%',
              minHeight: 320,
              height: '50vh',
              maxHeight: 560,
              border: '1px solid var(--bg-3)',
              borderRadius: 'var(--r-md)',
              overflow: 'hidden',
              background: '#0e1a20',
            }}
          />
        </div>
      </div>
    </div>
  );
}

function isSoldierId(id: string, list: SoldierTemplate[]): boolean {
  return list.some((t) => t.id === id);
}

function primaryWeaponFor(u: Unit, weapons: Weapon[]): Weapon | null {
  if (!u.loadout) return null;
  return weapons.find((w) => w.id === u.loadout!.primaryId) ?? null;
}

function sidearmWeaponFor(u: Unit, weapons: Weapon[]): Weapon | null {
  if (!u.loadout) return null;
  return weapons.find((w) => w.id === u.loadout!.sidearmId) ?? null;
}

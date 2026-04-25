import { Container, Graphics } from 'pixi.js';
import { useCombatStore } from '../../state/combatStore';
import { useContent } from '../../content/registry';
import { chebyshev } from '../engine/grid';
import { hasLineOfSight } from '../engine/los';
import { gridToScreen } from './isoProjection';
import { diamond } from './context';

/**
 * Paint the overlay layer — everything tied to the *current frame of
 * store state* rather than the static map: smoke clouds, reach hints
 * for the selected unit, fire/utility targeting highlights, and (new)
 * threat overlays warning where movement is exposed to enemy LOS.
 *
 * Called on every store change. Rebuilds the whole layer from scratch
 * (cheap relative to tile layer + unit layer).
 */
export function redrawOverlays(
  layer: Container,
  st: ReturnType<typeof useCombatStore.getState>,
) {
  layer.removeChildren();

  const g = new Graphics();
  const smokeSet = new Set(st.smokeTiles.keys());

  // Smoke clouds (always drawn, regardless of selection state).
  for (const [k, rounds] of st.smokeTiles) {
    const x = k % 4096, y = Math.floor(k / 4096);
    const p = gridToScreen({ x, y });
    // Fade as the cloud nears dissipation.
    const alpha = rounds >= 2 ? 0.6 : 0.4;
    diamond(g, p.x, p.y, 0xc8c8d0, alpha, 0xa0a0b0);
  }

  const sel = st.units.find((u) => u.id === st.selectedId);
  if (!sel || sel.faction !== 'player' || !sel.alive) {
    layer.addChild(g);
    return;
  }

  const idleOrMove = (st.mode === 'move' || st.mode === 'idle')
    && st.pendingUtility === null && st.pendingShotTargetId === null;

  // ---- Threat pass: tiles the player CAN reach but where an enemy has
  // LOS + range to shoot. Only computed in idle/move (the only modes
  // where the player is choosing where to walk). Bounded to reach, so
  // cost stays at O(reach × enemies) — typical mission ~30 × 6 = 180
  // checks per redraw.
  //
  // Two threat tiers:
  //   - 'overwatch': enemy is alive AND has status.overwatch — moving
  //     here triggers immediate reaction fire. Stronger red.
  //   - 'threat': enemy can shoot you next turn, but no overwatch is
  //     pending. Light red wash.
  // Each tile keeps the WORST tier so a tile threatened by both an
  // overwatcher and a normal enemy reads as overwatch.
  const threatByTile = new Map<number, 'threat' | 'overwatch'>();
  if (idleOrMove) {
    const enemies = st.units.filter((u) => u.faction === 'enemy' && u.alive);
    for (const tileKey of st.reach.keys()) {
      const tx = tileKey % 4096, ty = Math.floor(tileKey / 4096);
      if (tx === sel.pos.x && ty === sel.pos.y) continue;
      let worst: 'threat' | 'overwatch' | null = null;
      for (const enemy of enemies) {
        if (chebyshev(enemy.pos, { x: tx, y: ty }) > enemy.rangeLong) continue;
        if (!hasLineOfSight(st.map, enemy.pos, { x: tx, y: ty }, smokeSet)) continue;
        if (enemy.status.overwatch) { worst = 'overwatch'; break; }
        worst = worst ?? 'threat';
      }
      if (worst) threatByTile.set(tileKey, worst);
    }
  }

  // Movement reach when not targeting. Threat tiers composite ON TOP of
  // the gold/copper reach so the player still reads "I can go here" but
  // also "this would expose me."
  if (idleOrMove) {
    for (const [k, d] of st.reach) {
      const x = k % 4096, y = Math.floor(k / 4096);
      if (x === sel.pos.x && y === sel.pos.y) continue;
      const p = gridToScreen({ x, y });
      const apCost = Math.ceil(d / sel.mobility);
      // Gold for 1-AP (primary "your reach"), copper for 2-AP (stretched).
      // Both tones harmonise with the desert palette instead of fighting
      // it like the old blue/yellow pair did.
      const color = apCost <= 1 ? 0xe8c488 : 0xc87846;
      diamond(g, p.x, p.y, color, 0.22, color);
      const threat = threatByTile.get(k);
      if (threat === 'overwatch') {
        // Strong red wash — matches the danger tone used elsewhere
        // (PendingShotCard border, hit-flash) so the player reads
        // overwatch as the same family of "danger right now."
        diamond(g, p.x, p.y, 0xff5a6a, 0.32, 0xff5a6a);
      } else if (threat === 'threat') {
        diamond(g, p.x, p.y, 0xff5a6a, 0.14);
      }
    }
  }

  // Visible-enemy hints in idle/move: a thin red ring around any enemy
  // currently in the selected unit's LOS. Lets the player scan threats
  // without flipping into Fire mode.
  if (idleOrMove) {
    for (const enemy of st.units) {
      if (enemy.faction !== 'enemy' || !enemy.alive) continue;
      if (!hasLineOfSight(st.map, sel.pos, enemy.pos, smokeSet)) continue;
      const p = gridToScreen(enemy.pos);
      // Outline-only diamond (no fill) so the enemy sprite stays clear.
      drawDiamondRing(g, p.x, p.y, 0xff5a6a, 0.5);
    }
  }

  // Fire / Sidearm mode: mark valid targets in LOS (smoke blocks).
  if (st.mode === 'fire' || st.mode === 'sidearm') {
    for (const enemy of st.units) {
      if (enemy.faction !== 'enemy' || !enemy.alive) continue;
      if (!hasLineOfSight(st.map, sel.pos, enemy.pos, smokeSet)) continue;
      const p = gridToScreen(enemy.pos);
      const pending = st.pendingShotTargetId === enemy.id;
      diamond(g, p.x, p.y, 0xff5a6a, pending ? 0.45 : 0.28, 0xff5a6a);
    }
  }

  // Utility mode: shade tiles within throw range; highlight AoE if a target is pending.
  if (st.mode === 'utility' && st.selectedUtilityIdx !== null && sel.loadout) {
    const util = useContent().utilities[sel.loadout.utilityIds[st.selectedUtilityIdx]];
    if (util) {
      for (let y = 0; y < st.map.height; y++) {
        for (let x = 0; x < st.map.width; x++) {
          if (chebyshev(sel.pos, { x, y }) > util.range) continue;
          const p = gridToScreen({ x, y });
          diamond(g, p.x, p.y, 0xff9a3c, 0.08);
        }
      }
      if (st.pendingUtility) {
        const c = st.pendingUtility.center;
        for (let y = 0; y < st.map.height; y++) {
          for (let x = 0; x < st.map.width; x++) {
            if (chebyshev(c, { x, y }) > util.radius) continue;
            const p = gridToScreen({ x, y });
            diamond(g, p.x, p.y, 0xff9a3c, 0.35, 0xff9a3c);
          }
        }
      }
    }
  }

  layer.addChild(g);
}

/**
 * Outline-only iso diamond — a ring around the tile without any fill.
 * Used for visible-enemy hints so the enemy sprite remains clearly
 * legible underneath. Imported nowhere else; local to this file.
 */
function drawDiamondRing(g: Graphics, cx: number, cy: number, color: number, alpha: number) {
  // 32×16 iso half-extents matching `diamond` in context.ts. Hard-coded
  // here rather than re-deriving so this helper stays self-contained.
  const HW = 32, HH = 16;
  g.moveTo(cx, cy - HH);
  g.lineTo(cx + HW, cy);
  g.lineTo(cx, cy + HH);
  g.lineTo(cx - HW, cy);
  g.closePath();
  g.stroke({ color, width: 1.5, alpha });
}

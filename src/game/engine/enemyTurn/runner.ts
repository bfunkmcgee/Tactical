import type { CombatState } from '../../../state/combatStore';
import type { UnitId } from '../../types';
import type { AiGrenade } from '../ai';
import { evaluateObjective } from '../objectives';
import { planNextStep } from './planner';
import { resolveStep, type StepDeps, type EnemyStep } from './steps';

/**
 * Async orchestrator for the enemy turn. Walks each alive enemy in order;
 * for each, plans → resolves a chain of steps until the actor either
 * waits, dies, or runs out of AP. Any mission-end condition (no players
 * alive, objective complete) short-circuits the loop.
 *
 * The per-step delay is advisory from `resolveStep` — the runner honors
 * it between step applications so the renderer has time to animate the
 * intermediate state. In tests `sleep` is a no-op.
 */

export type RunnerHandles = {
  getState: () => CombatState;
  applyPatch: (patch: Partial<CombatState>) => void;
  sleep: (ms: number) => Promise<void>;
  /** Grenade profile lookup — pack-aware, supplied by the store. */
  grenadeForTemplate: (templateId: string) => AiGrenade | undefined;
  /** Step deps threaded into every `resolveStep` call. */
  stepDeps: StepDeps;
};

/**
 * Drive one enemy turn. Resolves when the last enemy has finished acting
 * (or the mission ends mid-turn). Does NOT perform end-of-round cleanup
 * — `finalizeEnemyTurn` in engine/turn.ts remains the caller's
 * responsibility after this resolves.
 */
export async function runEnemyTurn(h: RunnerHandles): Promise<{ ended: boolean }> {
  const initialEnemies = h.getState().units.filter((u) => u.faction === 'enemy' && u.alive);
  for (const snapshot of initialEnemies) {
    if (await processOneEnemy(snapshot.id, h)) return { ended: true };
  }
  return { ended: false };
}

async function processOneEnemy(
  enemyId: UnitId,
  h: RunnerHandles,
): Promise<boolean> {
  // Loop: plan → resolve chain → loop again. Re-check the actor each
  // iteration so mid-turn deaths (overwatch) exit cleanly.
  while (true) {
    const state = h.getState();
    const actor = state.units.find((u) => u.id === enemyId && u.alive);
    if (!actor || actor.ap <= 0) return false;

    const grenade = h.grenadeForTemplate(actor.templateId);
    const initialStep = planNextStep(state, actor, grenade);
    if (initialStep.kind === 'wait') return false;

    // Walk the `next` chain from the first step. Each resolveStep call
    // can return a follow-on (movement continuation) that we consume
    // before re-planning. Step chains keep animation delays visible to
    // the renderer by going through `applyPatch` + `sleep`.
    const ended = await runStepChain(initialStep, h);
    if (ended) return true;
  }
}

async function runStepChain(
  firstStep: EnemyStep,
  h: RunnerHandles,
): Promise<boolean> {
  let step: EnemyStep | undefined = firstStep;
  while (step) {
    const result = resolveStep(h.getState(), step, h.stepDeps);
    if (result.applied) h.applyPatch(result.patch);
    // Check mission end after every applied step so overwatch kills /
    // grenades / last-soldier-down cause immediate exit.
    if (checkEndApply(h)) return true;
    if (result.delayMs > 0) await h.sleep(result.delayMs);
    step = result.next;
  }
  return false;
}

function checkEndApply(h: RunnerHandles): boolean {
  const outcome = evaluateObjective(h.getState());
  if (outcome === 'won') { h.applyPatch({ phase: 'won' }); return true; }
  if (outcome === 'lost') { h.applyPatch({ phase: 'lost' }); return true; }
  return false;
}

import { LoopController, type LoopObservation, type StopReason } from "./LoopController";
import type { GuardrailReport } from "../plan/GuardrailPolicy";

/**
 * v2.5 — bounded auto-orchestration decision core for `run --until`.
 *
 * STRICTLY BOUNDED, model-free, and side-effect-free. It NEVER spawns an agent
 * and NEVER runs unattended: it only answers "may the caller take one more
 * step?" by combining the LoopController caps (max-steps / budget / divergence)
 * with the deterministic GuardrailPolicy (changed-file / step / budget caps).
 * The caller is responsible for the confirmation prompt — this controller just
 * surfaces whether confirmation is required. This is NOT an autopilot: removing
 * the human confirmation gate or the step cap is out of scope by design.
 */

export type OrchestrationStop = StopReason | "guardrail";

export interface OrchestrationDecision {
  proceed: boolean;
  /** 1-based index of the step about to run (when proceed). */
  step: number;
  reason?: OrchestrationStop;
  /** When proceeding, whether the caller MUST get human confirmation first. */
  requireConfirmation: boolean;
  /** The guardrail snapshot consulted for this decision, when available. */
  guardrail?: GuardrailReport;
}

export interface BoundedOrchestratorConfig {
  /** Hard cap on extra steps. Clamped to >= 1 by LoopController. */
  maxSteps: number;
  /** Stop if budgetRatio meets/exceeds this (0..1). */
  budgetCeiling?: number;
  /**
   * Optional deterministic guardrail evaluator (e.g. GuardrailPolicy.evaluate).
   * Re-checked before every step; a blocked report stops the loop.
   */
  evaluateGuardrail?: () => GuardrailReport | null;
}

export class BoundedOrchestrator {
  private readonly loop: LoopController;
  private readonly evaluateGuardrail?: () => GuardrailReport | null;

  constructor(config: BoundedOrchestratorConfig) {
    this.loop = new LoopController({ maxSteps: config.maxSteps, budgetCeiling: config.budgetCeiling });
    this.evaluateGuardrail = config.evaluateGuardrail;
  }

  get currentStep(): number {
    return this.loop.currentStep;
  }

  stop(): void {
    this.loop.stop();
  }

  /**
   * Ask whether to run the next step. Call BEFORE running it; pass the
   * observation from the PREVIOUS step (omit on the first call).
   */
  next(obs: LoopObservation = {}): OrchestrationDecision {
    const decision = this.loop.next(obs);
    if (!decision.proceed) {
      return { ...decision, requireConfirmation: false };
    }

    // The loop would proceed — now consult the guardrail policy (if any).
    const guardrail = this.evaluateGuardrail?.() ?? undefined;
    if (guardrail?.blocked) {
      return { proceed: false, step: decision.step - 1, reason: "guardrail", requireConfirmation: false, guardrail };
    }

    return {
      proceed: true,
      step: decision.step,
      requireConfirmation: guardrail?.requireConfirmation ?? true,
      guardrail,
    };
  }
}

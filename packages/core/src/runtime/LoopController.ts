/**
 * Bounded automation guard (v0.9). Pure and model-free. Decides whether a
 * multi-turn plan↔execute loop may take another step. It NEVER spawns anything;
 * the caller runs a step, reports an observation, and asks the controller what
 * to do next. The whole point is to make "continue" *bounded* — never an
 * unbounded autopilot.
 */
export interface LoopObservation {
  /** Ratio of context weight to budget (0..1+) measured before this step. */
  budgetRatio?: number;
  /**
   * A cheap signal of forward progress for the step that just ran, e.g. the
   * count of changed files, or a hash of plan.md. The controller flags
   * divergence when this value does not change across two consecutive steps.
   */
  progressKey?: string;
}

export type StopReason =
  | "max-steps"
  | "budget"
  | "divergence"
  | "explicit-stop";

export interface LoopDecision {
  proceed: boolean;
  /** 1-based index of the step about to run (when proceed) or that was last considered. */
  step: number;
  reason?: StopReason;
}

export interface LoopConfig {
  /** Hard cap on steps. Clamped to >= 1. */
  maxSteps: number;
  /** Stop if budgetRatio meets/exceeds this (0..1). Default 0.95. */
  budgetCeiling?: number;
}

export class LoopController {
  private step = 0;
  private lastProgressKey: string | undefined;
  private stopped = false;
  private readonly maxSteps: number;
  private readonly budgetCeiling: number;

  constructor(config: LoopConfig) {
    this.maxSteps = Math.max(1, Math.floor(config.maxSteps));
    this.budgetCeiling = config.budgetCeiling ?? 0.95;
  }

  get currentStep(): number {
    return this.step;
  }

  /** Explicitly halt the loop (e.g. user Ctrl-C or a step error). */
  stop(): void {
    this.stopped = true;
  }

  /**
   * Ask whether to run the next step. Call BEFORE running a step; pass the
   * observation from the PREVIOUS step (omit on the first call).
   */
  next(obs: LoopObservation = {}): LoopDecision {
    if (this.stopped) {
      return { proceed: false, step: this.step, reason: "explicit-stop" };
    }
    if (this.step >= this.maxSteps) {
      return { proceed: false, step: this.step, reason: "max-steps" };
    }
    if (obs.budgetRatio !== undefined && obs.budgetRatio >= this.budgetCeiling) {
      return { proceed: false, step: this.step, reason: "budget" };
    }
    // Divergence: the previous step produced the same progress key as the one
    // before it — we are spinning without making progress.
    if (
      this.step >= 1 &&
      obs.progressKey !== undefined &&
      this.lastProgressKey !== undefined &&
      obs.progressKey === this.lastProgressKey
    ) {
      return { proceed: false, step: this.step, reason: "divergence" };
    }
    if (obs.progressKey !== undefined) this.lastProgressKey = obs.progressKey;
    this.step += 1;
    return { proceed: true, step: this.step };
  }
}

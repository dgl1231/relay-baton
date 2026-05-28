/**
 * Canonical section headings for `.ai-session/plan.md`.
 * Shared between PromptBuilder.planner (what we ask the planner to produce)
 * and PlanQualityGate (what we verify before letting the executor run).
 */
export const PLAN_SECTIONS = [
  "Goal",
  "Scope (in)",
  "Out of scope",
  "Approach",
  "Steps",
  "Risks",
  "Verification",
  "Next step",
] as const;

export type PlanSection = (typeof PLAN_SECTIONS)[number];

/**
 * Returns the body text under a `## <title>` heading, up to the next `## ` or
 * end of document. Empty string if the section is missing.
 */
export function planSectionBody(planMd: string, title: string): string {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(^|\\n)## ${escaped}\\s*\\n([\\s\\S]*?)(?=\\n## |\\n# |$)`);
  const m = re.exec(planMd);
  return m ? m[2].trim() : "";
}

/** An empty plan template the planner is asked to fill in. */
export function planTemplate(goal = ""): string {
  return [
    "# relay-baton plan",
    "",
    "## Goal",
    goal.trim() || "(what outcome are we after?)",
    "",
    "## Scope (in)",
    "(what this change covers)",
    "",
    "## Out of scope",
    "(what we deliberately are NOT doing)",
    "",
    "## Approach",
    "(high-level strategy, key files, ordering)",
    "",
    "## Steps",
    "1. (first concrete step)",
    "",
    "## Risks",
    "(uncertainties; flag them here instead of guessing in Steps)",
    "",
    "## Verification",
    "(how the executor will know it is done — tests/build/commands)",
    "",
    "## Next step",
    "(exactly one bullet for the executor to start with)",
    "",
  ].join("\n");
}

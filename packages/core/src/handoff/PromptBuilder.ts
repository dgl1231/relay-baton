export class PromptBuilder {
  /** Back-compat alias; the continuation prompt is agent-agnostic (v2.3). */
  static claudeContinuation(): string {
    return PromptBuilder.continuation();
  }

  /**
   * Generic handoff-continuation prompt for the NEXT agent in a relay chain,
   * whichever agent that is (Codex↔Claude, reverse, or N-way). Agent-agnostic.
   */
  static continuation(): string {
    return [
      "You are continuing work from a previous coding agent through relay-baton.",
      "",
      "This is a handoff, not a new task.",
      "",
      "Read these files first:",
      "- AGENTS.md, if it exists",
      "- CLAUDE.md, if it exists",
      "- .ai-session/task.md",
      "- .ai-session/handoff.md",
      "- .ai-session/compact-state.md",
      "- .ai-session/changed-files.md",
      "- .ai-session/repo-map.md",
      "- .ai-session/test-results.md",
      "",
      "Rules:",
      "1. Do not restart from scratch.",
      "2. Trust the current repository state over any assumptions.",
      "3. Inspect git diff before editing.",
      "4. Continue from the \"Next Steps\" section in .ai-session/handoff.md.",
      "5. Preserve existing architecture, naming, and style.",
      "6. Keep changes minimal and targeted.",
      "7. After each meaningful step, update .ai-session/state.md.",
      "8. Before finishing, run relevant tests or explain why tests could not be run.",
      "9. Do not auto-commit unless explicitly asked.",
      "",
      "Token diet rules:",
      "1. Do not read full logs unless necessary.",
      "2. Start with .ai-session/handoff.md and .ai-session/compact-state.md.",
      "3. Read .ai-session/full-diff.patch only if the diff summary is insufficient.",
      "4. Read AGENTS.md and CLAUDE.md by reference, do not ask the user to paste them.",
      "5. Keep your own updates to .ai-session/state.md concise.",
      "6. Avoid re-analyzing unrelated files.",
      "7. Prefer targeted edits over broad refactors.",
      "8. Before asking for more context, inspect the referenced files first.",
      "9. Be concise.",
      "10. Remove filler.",
      "11. Use short direct bullets when reporting progress.",
      "12. Do not repeat the handoff content.",
      "",
      "Immediate task:",
      "Continue the implementation from the handoff file and complete the remaining work.",
    ].join("\n");
  }

  /**
   * Planner prompt for v0.5 plan-execute mode. The planner reads the repo and
   * writes .ai-session/plan.md — it does NOT write code.
   */
  static planner(task: string): string {
    return [
      "You are the PLANNER in a relay-baton plan-execute workflow.",
      "",
      "Your only job is to write a plan document. DO NOT write or edit any source code.",
      "",
      "Read these first (by reference — do not paste their full contents into the plan):",
      "- AGENTS.md, if it exists",
      "- CLAUDE.md, if it exists",
      "- .ai-session/task.md",
      "- .ai-session/repo-map.md",
      "",
      "Then write the plan to .ai-session/plan.md with EXACTLY these sections:",
      "",
      "# relay-baton plan",
      "## Goal",
      "## Scope (in)",
      "## Out of scope",
      "## Approach",
      "## Steps",
      "## Risks",
      "## Verification",
      "## Next step",
      "",
      "Rules:",
      "1. Every section above must be present and non-empty.",
      "2. Steps must be a numbered list of concrete, executable actions.",
      "3. Next step must be exactly one bullet — where the executor begins.",
      "4. Put uncertainty in Risks. Do not guess in Steps.",
      "5. Reference files by path; never inline full diffs, logs, AGENTS.md, or CLAUDE.md.",
      "6. The plan is a contract for another agent — keep it concrete and concise.",
      "7. Do not run the implementation yourself. Only produce plan.md.",
      "",
      "Task to plan:",
      task,
    ].join("\n");
  }

  /**
   * Executor prompt for v0.5 plan-execute mode. The executor implements from
   * .ai-session/plan.md.
   */
  static executor(): string {
    return [
      "You are the EXECUTOR in a relay-baton plan-execute workflow.",
      "",
      "A planner has written .ai-session/plan.md. Implement it.",
      "",
      "Read these first:",
      "- AGENTS.md, if it exists",
      "- CLAUDE.md, if it exists",
      "- .ai-session/plan.md   (your contract — start from its Next step)",
      "- .ai-session/repo-map.md",
      "",
      "Rules:",
      "1. Follow the plan's Steps in order. Begin from the Next step.",
      "2. Inspect git diff before editing; trust the repo state over assumptions.",
      "3. After each meaningful step, update .ai-session/state.md concisely.",
      "4. If reality diverges from the plan, STOP and write the discrepancy to",
      "   .ai-session/errors.md instead of silently improvising.",
      "5. Preserve existing architecture, naming, and style. Keep changes targeted.",
      "6. Before finishing, run the plan's Verification commands, or explain why not.",
      "7. Do not rewrite plan.md — it is the contract.",
      "8. Do not auto-commit unless explicitly asked.",
      "",
      "Token diet:",
      "- Read full-diff.patch / commands.log only if the summaries are insufficient.",
      "- Be concise; remove filler; report progress in short bullets.",
      "",
      "Immediate task:",
      "Implement .ai-session/plan.md, starting from its Next step.",
    ].join("\n");
  }
}

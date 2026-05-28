import { describe, it, expect } from "vitest";
import { HandoffGenerator, HandoffInput } from "../handoff/HandoffGenerator";
import { defaultConfig } from "../config/defaultConfig";
import { REFS } from "../token-diet/ReferenceResolver";

function baseInput(overrides: Partial<HandoffInput> = {}): HandoffInput {
  return {
    goal: "Fix the upload bug",
    previousAgent: "codex",
    nextAgent: "claude",
    fallbackReason: "Detected pattern \"quota exceeded\"",
    profileName: "balanced",
    profile: defaultConfig.tokenDiet.profiles.balanced,
    gitStatus: "## main\n M src/foo.ts",
    repoMapSummary: "# Repo Map\nfoo/\n",
    relevantFiles: [
      { path: "src/foo.ts", reason: "changed" },
      { path: "package.json", reason: "key project file" },
    ],
    changedFiles: ["src/foo.ts", "src/bar.ts"],
    progressSummary: "# Compact State\n## Goal\nfix upload\n",
    importantDiff: "diff --git a/x b/x\n@@\n-old\n+new\n",
    knownErrors: ["build failed: tsc exit 2"],
    testResults: "1/2 passed",
    nextSteps: [],
    truncated: false,
    ...overrides,
  };
}

/**
 * Top-level section titles, in the order the generator emits them.
 *
 * Skips `##` lines inside fenced code blocks (e.g. `## main` inside the
 * git-status fence) and skips repeats of known titles that show up as
 * sub-headings inside arbitrary section bodies (e.g. a `## Goal` line that
 * lives inside the Progress Summary block, which is just compactState content).
 *
 * The HandoffGenerator emits each canonical title at most once, so taking the
 * first occurrence is faithful.
 */
function sectionOrder(md: string): string[] {
  const known = new Set([
    "Goal",
    "Previous Agent",
    "Next Agent",
    "Fallback Reason",
    "Token Diet Summary",
    "Current Repository State",
    "Repo Map",
    "Relevant Files",
    "Changed Files",
    "Progress Summary",
    "Important Diff",
    "Known Errors",
    "Test Results",
    "Next Steps",
    "Instructions for Next Agent",
  ]);
  const out: string[] = [];
  const seen = new Set<string>();
  let inFence = false;
  for (const line of md.split(/\r?\n/)) {
    if (/^```/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (!m) continue;
    const title = m[1].trim();
    if (!known.has(title) || seen.has(title)) continue;
    seen.add(title);
    out.push(title);
  }
  return out;
}

describe("HandoffGenerator", () => {
  it("emits every required section in the canonical order", () => {
    const md = new HandoffGenerator().generate(baseInput());
    expect(sectionOrder(md)).toEqual([
      "Goal",
      "Previous Agent",
      "Next Agent",
      "Fallback Reason",
      "Token Diet Summary",
      "Current Repository State",
      "Repo Map",
      "Relevant Files",
      "Changed Files",
      "Progress Summary",
      "Important Diff",
      "Known Errors",
      "Test Results",
      "Next Steps",
      "Instructions for Next Agent",
    ]);
  });

  it("Token Diet Summary references the off-handoff artifact files", () => {
    const md = new HandoffGenerator().generate(baseInput());
    expect(md).toContain(`Full diff stored at: ${REFS.fullDiff}`);
    expect(md).toContain(`Full logs stored at: ${REFS.fullLog}`);
    expect(md).toContain(`Compact state stored at: ${REFS.compactState}`);
    expect(md).toContain("Profile: balanced");
    expect(md).toContain(`Max handoff chars: ${defaultConfig.tokenDiet.profiles.balanced.maxHandoffChars}`);
  });

  it("adds the truncated-warning line only when truncated=true", () => {
    const generator = new HandoffGenerator();
    const off = generator.generate(baseInput({ truncated: false }));
    const on = generator.generate(baseInput({ truncated: true }));
    expect(off).not.toContain("Some sections may be truncated");
    expect(on).toContain("Some sections may be truncated");
  });

  it("emits 'manual handoff' when fallbackReason is null", () => {
    const md = new HandoffGenerator().generate(baseInput({ fallbackReason: null }));
    expect(/## Fallback Reason\s+manual handoff/.test(md)).toBe(true);
  });

  it("uses sentinel text when goal / changedFiles / knownErrors / relevantFiles are empty", () => {
    const md = new HandoffGenerator().generate(
      baseInput({
        goal: "",
        relevantFiles: [],
        changedFiles: [],
        knownErrors: [],
        testResults: "",
      }),
    );
    expect(md).toContain("(no goal recorded)");
    expect(md).toContain("(none selected)");
    expect(/## Changed Files\s+\(none\)/.test(md)).toBe(true);
    expect(md).toContain("(none detected)");
    expect(md).toContain("No tests were run yet.");
  });

  it("wraps importantDiff in a ```diff fenced block and references the full-diff snapshot", () => {
    const md = new HandoffGenerator().generate(baseInput());
    // The section opens with the reference line, then the fenced block.
    const m = /## Important Diff\s+Full diff snapshot: ([^\n]+)\s+```diff\s+([\s\S]*?)\s+```/.exec(md);
    expect(m).not.toBeNull();
    expect(m![1].trim()).toBe(REFS.fullDiff);
    expect(m![2]).toContain("diff --git");
    expect(m![2]).toContain("+new");
  });

  it("falls back to default next-step bullets when nextSteps is empty", () => {
    const md = new HandoffGenerator().generate(baseInput({ nextSteps: [] }));
    expect(md).toContain("- Inspect git diff.");
    expect(md).toContain("- Update .ai-session/state.md.");
  });

  it("honors caller-supplied nextSteps when present", () => {
    const md = new HandoffGenerator().generate(
      baseInput({ nextSteps: ["finish API mapping", "run pnpm test"] }),
    );
    expect(md).toContain("- finish API mapping");
    expect(md).toContain("- run pnpm test");
    // The default bullets should not appear when user supplies their own.
    expect(md).not.toContain("- Inspect git diff.");
  });

  it("emits 'Used chars' line only when usedChars is provided", () => {
    const without = new HandoffGenerator().generate(baseInput());
    const withIt = new HandoffGenerator().generate(baseInput({ usedChars: 1234 }));
    expect(without).not.toContain("Used chars");
    expect(withIt).toContain("Used chars (pre-compact estimate): 1234");
  });

  it("emits non-empty Instructions for Next Agent section", () => {
    const md = new HandoffGenerator().generate(baseInput());
    const m = /## Instructions for Next Agent\s+([\s\S]+)$/.exec(md);
    expect(m).not.toBeNull();
    // The instructions block is a bulleted list — ensure several bullets are present.
    const bullets = m![1].split("\n").filter(l => l.startsWith("- "));
    expect(bullets.length).toBeGreaterThanOrEqual(8);
  });

  it("uses '(clean)' when gitStatus is empty", () => {
    const md = new HandoffGenerator().generate(baseInput({ gitStatus: "" }));
    expect(/## Current Repository State\s+```\s+\(clean\)\s+```/.test(md)).toBe(true);
  });
});

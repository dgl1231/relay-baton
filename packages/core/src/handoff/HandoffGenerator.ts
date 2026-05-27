import type { DietProfile, DietProfileName } from "@relay-baton/shared";
import { REFS } from "../token-diet/ReferenceResolver";
import type { RelevantFile } from "../token-diet/ContextSelector";

export interface HandoffInput {
  goal: string;
  previousAgent: string;
  nextAgent: string;
  fallbackReason: string | null;
  profileName: DietProfileName;
  profile: DietProfile;
  gitStatus: string;
  repoMapSummary: string;
  relevantFiles: RelevantFile[];
  changedFiles: string[];
  progressSummary: string;
  importantDiff: string;
  knownErrors: string[];
  testResults: string;
  nextSteps: string[];
  truncated: boolean;
  usedChars?: number;
}

export class HandoffGenerator {
  generate(i: HandoffInput): string {
    const p: string[] = [];
    p.push("# Relay Baton Handoff");
    p.push("");
    p.push("## Goal");
    p.push(""); p.push(i.goal.trim() || "(no goal recorded)");
    p.push("");
    p.push("## Previous Agent"); p.push(""); p.push(i.previousAgent); p.push("");
    p.push("## Next Agent"); p.push(""); p.push(i.nextAgent); p.push("");
    p.push("## Fallback Reason"); p.push("");
    p.push(i.fallbackReason ?? "manual handoff"); p.push("");

    p.push("## Token Diet Summary"); p.push("");
    p.push(`- Profile: ${i.profileName}`);
    p.push(`- Max handoff chars: ${i.profile.maxHandoffChars}`);
    if (i.usedChars != null) p.push(`- Used chars (pre-compact estimate): ${i.usedChars}`);
    p.push(`- Full diff stored at: ${REFS.fullDiff}`);
    p.push(`- Full logs stored at: ${REFS.fullLog}`);
    p.push(`- Compact state stored at: ${REFS.compactState}`);
    if (i.truncated) p.push(`- Some sections may be truncated to reduce token usage.`);
    p.push("");

    p.push("## Current Repository State"); p.push("");
    p.push("```"); p.push(i.gitStatus.trim() || "(clean)"); p.push("```"); p.push("");

    p.push("## Repo Map"); p.push("");
    p.push(`See ${REFS.repoMap} for the full map.`); p.push("");
    p.push(i.repoMapSummary.trim()); p.push("");

    p.push("## Relevant Files"); p.push("");
    if (i.relevantFiles.length === 0) p.push("(none selected)");
    else for (const f of i.relevantFiles) p.push(`- ${f.path} — ${f.reason}`);
    p.push("");

    p.push("## Changed Files"); p.push("");
    if (i.changedFiles.length === 0) p.push("(none)");
    else for (const f of i.changedFiles) p.push(`- ${f}`);
    p.push("");

    p.push("## Progress Summary"); p.push("");
    p.push(i.progressSummary.trim() || "(see compact-state.md)"); p.push("");

    p.push("## Important Diff"); p.push("");
    p.push(`Full diff snapshot: ${REFS.fullDiff}`); p.push("");
    p.push("```diff"); p.push(i.importantDiff.trim() || "(no diff)"); p.push("```"); p.push("");

    p.push("## Known Errors"); p.push("");
    if (i.knownErrors.length === 0) p.push("(none detected)");
    else for (const e of i.knownErrors) p.push(`- ${e}`);
    p.push("");

    p.push("## Test Results"); p.push("");
    p.push(i.testResults.trim() || "No tests were run yet."); p.push("");

    p.push("## Next Steps"); p.push("");
    if (i.nextSteps.length === 0) {
      p.push("- Inspect git diff.");
      p.push("- Continue implementation from current state.");
      p.push("- Run build/test.");
      p.push("- Update .ai-session/state.md.");
    } else for (const s of i.nextSteps) p.push(`- ${s}`);
    p.push("");

    p.push("## Instructions for Next Agent"); p.push("");
    for (const line of INSTRUCTIONS) p.push(`- ${line}`);
    p.push("");

    return p.join("\n");
  }
}

const INSTRUCTIONS = [
  "처음부터 다시 시작하지 마라.",
  "이전 추정보다 현재 repository 상태를 우선해라.",
  "AGENTS.md가 있으면 먼저 읽어라.",
  "Claude Code라면 CLAUDE.md가 있으면 먼저 읽어라.",
  ".ai-session/handoff.md와 .ai-session/compact-state.md부터 읽어라.",
  "수정 전 git diff를 확인해라.",
  "diff summary가 부족할 때만 .ai-session/full-diff.patch를 읽어라.",
  "log summary가 부족할 때만 .ai-session/commands.log를 읽어라.",
  "현재 상태에서 이어서 진행해라.",
  "기존 architecture, naming, style을 유지해라.",
  "변경은 작고 목적에 맞게 유지해라.",
  "의미 있는 진행 후 .ai-session/state.md를 갱신해라.",
  "완료 전 관련 테스트를 실행하거나, 실행하지 못했다면 이유를 남겨라.",
  "명시적으로 요청받지 않는 한 auto-commit하지 마라.",
];

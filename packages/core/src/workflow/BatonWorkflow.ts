import * as fs from "fs";
import type { DietProfileName, RelayBatonConfig } from "@relay-baton/shared";
import { SessionManager } from "../session/SessionManager";
import { SessionFiles } from "../session/SessionFiles";
import { GitService } from "../git/GitService";
import { RepoMapGenerator } from "../git/RepoMapGenerator";
import { ContextSelector } from "../token-diet/ContextSelector";
import { DiffCompactor } from "../token-diet/DiffCompactor";
import { LogCompactor } from "../token-diet/LogCompactor";
import { StateCompactor } from "../token-diet/StateCompactor";
import { HandoffGenerator } from "../handoff/HandoffGenerator";
import { HandoffCompactor } from "../token-diet/HandoffCompactor";

export interface BuildHandoffOpts {
  profileName: DietProfileName;
  fallbackReason: string | null;
  previousAgent: string;
  nextAgent: string;
}

export interface BuildHandoffResult {
  handoffPath: string;
  truncated: boolean;
  usedChars: number;
  budgetSnapshot: any;
}

export class BatonWorkflow {
  constructor(public sm: SessionManager, public cfg: RelayBatonConfig) {}

  refreshArtifacts(profileName: DietProfileName) {
    const profile = this.cfg.tokenDiet.profiles[profileName];
    const files = new SessionFiles(this.sm.repoRoot);
    const git = new GitService(this.sm.repoRoot);

    const status = git.status();
    const changed = git.changedFiles();
    const fullDiff = git.diff();
    fs.writeFileSync(files.p("fullDiff"), fullDiff, "utf8");

    fs.writeFileSync(
      files.p("changedFiles"),
      "# Changed Files\n\n" + (changed.length ? changed.map(c => `- ${c}`).join("\n") + "\n" : "(none)\n"),
      "utf8",
    );

    const repoMap = new RepoMapGenerator(this.sm.repoRoot).generate(profile.maxRepoMapChars, changed);
    fs.writeFileSync(files.p("repoMap"), repoMap, "utf8");

    const stateMd = fs.existsSync(files.p("state")) ? fs.readFileSync(files.p("state"), "utf8") : "";
    const compactState = new StateCompactor().compact(stateMd, profile.maxStateChars);
    fs.writeFileSync(files.p("compactState"), compactState, "utf8");

    return { status, changed, fullDiff, repoMap, compactState };
  }

  buildHandoff(opts: BuildHandoffOpts): BuildHandoffResult {
    const profile = this.cfg.tokenDiet.profiles[opts.profileName];
    const files = new SessionFiles(this.sm.repoRoot);
    const { status, changed, fullDiff, repoMap, compactState } = this.refreshArtifacts(opts.profileName);

    const task = fs.existsSync(files.p("task")) ? fs.readFileSync(files.p("task"), "utf8") : "";
    const goal = task.replace(/^#.*\n/, "").trim();

    const selector = new ContextSelector(this.sm.repoRoot);
    const relevant = selector.select(changed, task);

    const importantDiff = new DiffCompactor().compact(fullDiff, profile.maxDiffChars);

    const rawLog = fs.existsSync(files.p("commandsLog")) ? fs.readFileSync(files.p("commandsLog"), "utf8") : "";
    const logResult = new LogCompactor().compact(rawLog, profile.maxLogTailChars, this.cfg.fallbackPatterns);

    const testResults = fs.existsSync(files.p("testResults")) ? fs.readFileSync(files.p("testResults"), "utf8") : "";

    const repoMapSummary = repoMap.length > profile.maxRepoMapChars
      ? repoMap.slice(0, profile.maxRepoMapChars) + "\n... [truncated]\n"
      : repoMap;

    const handoffMd = new HandoffGenerator().generate({
      goal,
      previousAgent: opts.previousAgent,
      nextAgent: opts.nextAgent,
      fallbackReason: opts.fallbackReason,
      profileName: opts.profileName,
      profile,
      gitStatus: status,
      repoMapSummary,
      relevantFiles: relevant,
      changedFiles: changed,
      progressSummary: compactState,
      importantDiff,
      knownErrors: logResult.knownErrors,
      testResults,
      nextSteps: [],
      truncated: false,
    });

    this.sm.backupHandoffIfExists();
    const compacted = new HandoffCompactor().compact(handoffMd, profile.maxHandoffChars);
    fs.writeFileSync(files.p("handoff"), compacted.text, "utf8");

    const snapshot = {
      profile: opts.profileName,
      maxHandoffChars: profile.maxHandoffChars,
      used: {
        handoff: compacted.text.length,
        repoMap: repoMap.length,
        fullDiff: fullDiff.length,
        commandsLog: rawLog.length,
        compactState: compactState.length,
      },
      truncated: compacted.truncated,
      generatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(files.p("contextBudget"), JSON.stringify(snapshot, null, 2), "utf8");

    return {
      handoffPath: files.p("handoff"),
      truncated: compacted.truncated,
      usedChars: compacted.text.length,
      budgetSnapshot: snapshot,
    };
  }
}

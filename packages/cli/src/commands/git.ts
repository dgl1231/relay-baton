import * as fs from "fs";
import { GitBaseline, GitService, SessionFiles } from "@relay-baton/core";
import { ProjectOpts, resolveRepoRoot } from "./projectOptions";

export interface GitStatusOpts extends ProjectOpts {
  json?: boolean;
  limit?: string;
}

export async function gitStatusCommand(opts: GitStatusOpts = {}) {
  const repoRoot = resolveRepoRoot(opts);
  const limit = Number.parseInt(opts.limit || "40", 10);
  const git = new GitService(repoRoot);
  const summary = git.summary(Number.isFinite(limit) ? limit : 40);
  const tracking = git.compareBaseline(readBaseline(repoRoot));

  if (opts.json) {
    console.log(JSON.stringify({ repoRoot, ...summary, tracking }, null, 2));
    return;
  }

  if (!summary.available) {
    console.log("[relay-baton] git unavailable: current project is not a git repository.");
    return;
  }

  console.log("branch:", summary.branch ?? "(detached)");
  console.log("head:", summary.head ? summary.head.slice(0, 12) : "(none)");
  console.log("upstream:", summary.upstream ?? "(none)");
  console.log("ahead/behind:", `${summary.ahead}/${summary.behind}`);
  console.log("clean:", summary.clean ? "yes" : "no");
  console.log("changed:", summary.changed);
  console.log("staged:", summary.staged);
  console.log("unstaged:", summary.unstaged);
  console.log("untracked:", summary.untracked);
  if (tracking.baseline) {
    console.log("changed since session start:", tracking.changedSinceBaseline ? "yes" : "no");
    console.log("changed delta:", tracking.changedDelta ?? 0);
  } else {
    console.log("session baseline:", "(none)");
  }
  for (const file of summary.files) {
    console.log(`${file.code} ${file.path} (${file.label})`);
  }
}

function readBaseline(repoRoot: string): GitBaseline | null {
  try {
    const raw = fs.readFileSync(new SessionFiles(repoRoot).p("gitBaseline"), "utf8");
    return JSON.parse(raw) as GitBaseline;
  } catch {
    return null;
  }
}

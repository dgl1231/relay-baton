import { ConfigLoader, ExecutionCheckpoints, SessionManager, ConversationLog } from "@relay-baton/core";
import type { CheckpointResult } from "@relay-baton/core";
import { ProjectOpts, resolveRepoRoot } from "./projectOptions";

export interface CheckpointOpts extends ProjectOpts {
  command?: string;
  result?: string;
  note?: string;
  json?: boolean;
}

const RESULTS: CheckpointResult[] = ["ok", "fail", "pending"];

export async function checkpointCommand(step: string, opts: CheckpointOpts = {}) {
  const n = Number(step);
  if (!Number.isInteger(n) || n < 1) {
    console.error(`[relay-baton] step must be a positive integer, got: ${step}`);
    process.exit(2);
  }
  const result = (opts.result ?? "pending") as CheckpointResult;
  if (!RESULTS.includes(result)) {
    console.error(`[relay-baton] result must be one of ${RESULTS.join("|")}, got: ${opts.result}`);
    process.exit(2);
  }

  const repoRoot = resolveRepoRoot(opts);
  const { config } = ConfigLoader.load(repoRoot);
  const meta = new SessionManager(repoRoot, config).getMeta();

  const checkpoint = new ExecutionCheckpoints(repoRoot, config).append({
    step: n,
    command: opts.command,
    result,
    note: opts.note,
  });

  new ConversationLog(repoRoot).append({
    role: "relay-baton",
    kind: "execute",
    text: `checkpoint: step ${n} [${result}]${checkpoint.note ? " — " + checkpoint.note : ""}`,
    sessionId: meta?.id,
    meta: { stepRefs: [`step-${n}`], confirmed: true },
  });

  if (opts.json) {
    console.log(JSON.stringify(checkpoint, null, 2));
    return;
  }
  console.log(`[relay-baton] checkpoint recorded [${result}] for step ${n}.`);
  console.log(`git: ${checkpoint.git.branch ?? "(no git)"} · ${checkpoint.git.changed} changed file(s)`);
}

export async function checkpointSummaryCommand(opts: CheckpointOpts = {}) {
  const repoRoot = resolveRepoRoot(opts);
  const summary = new ExecutionCheckpoints(repoRoot).summarize();

  if (opts.json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }
  if (summary.total === 0) {
    console.log("[relay-baton] no execution checkpoints recorded.");
    return;
  }
  const { results } = summary;
  console.log(`[relay-baton] execution receipt: ${summary.total} checkpoint(s)`);
  console.log(`results: ${results.ok} ok · ${results.fail} fail · ${results.pending} pending`);
  console.log(`last: step ${summary.lastStep} [${summary.lastResult}]${summary.lastCommand ? " — " + summary.lastCommand : ""}`);
  console.log(`max changed files in a step: ${summary.maxChangedFiles}`);
  if (summary.latestBudget) {
    console.log(`latest budget: ${summary.latestBudget.handoffChars}/${summary.latestBudget.maxHandoffChars} chars (${summary.latestBudget.activeProfile})`);
  }
}

export async function checkpointListCommand(opts: CheckpointOpts = {}) {
  const repoRoot = resolveRepoRoot(opts);
  const checkpoints = new ExecutionCheckpoints(repoRoot).list();

  if (opts.json) {
    console.log(JSON.stringify(checkpoints, null, 2));
    return;
  }
  if (checkpoints.length === 0) {
    console.log("[relay-baton] no execution checkpoints recorded.");
    return;
  }
  for (const c of checkpoints) {
    const cmd = c.command ? ` — ${c.command}` : "";
    console.log(`[${c.result}] step ${c.step}${cmd} (${c.changedFiles.length} files, ${c.ts})`);
  }
}

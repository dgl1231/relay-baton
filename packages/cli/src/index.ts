#!/usr/bin/env node
import { Command } from "commander";
import { initCommand } from "./commands/init";
import { doctorCommand } from "./commands/doctor";
import { verifyCommand } from "./commands/verify";
import { statusCommand } from "./commands/status";
import { reviewCommand } from "./commands/review";
import { receiptDoneCommand, receiptSkipCommand, receiptListCommand } from "./commands/receipt";
import { checkpointCommand, checkpointListCommand, checkpointSummaryCommand } from "./commands/checkpoint";
import { guardCommand } from "./commands/guard";
import { riskCommand } from "./commands/risk";
import { workspaceCommand } from "./commands/workspace";
import { profileCommand } from "./commands/profile";
import { inventoryCommand } from "./commands/inventory";
import { runCommand } from "./commands/run";
import { handoffCommand } from "./commands/handoff";
import { handoffHistoryCommand } from "./commands/handoffHistory";
import { handoffShowCommand } from "./commands/handoffShow";
import { handoffBundleCommand, handoffInspectCommand } from "./commands/handoffBundle";
import { reportCommand } from "./commands/report";
import { planCommand } from "./commands/plan";
import { executeCommand } from "./commands/execute";
import { compressContextCommand } from "./commands/compressContext";
import { compactCommand } from "./commands/compact";
import { budgetCommand } from "./commands/budget";
import { compressCommand } from "./commands/compress";
import { tuiCommand } from "./commands/tui";
import { chatCommand } from "./commands/chat";
import { replayCommand } from "./commands/replay";
import { conversationAppendCommand } from "./commands/conversation";
import { gitStatusCommand } from "./commands/git";
import { sessionArchiveCommand, sessionListCommand, sessionInspectCommand, sessionResumeCommand } from "./commands/session";
import { loginCommand } from "./commands/login";
import {
  projectAddCommand,
  projectCurrentCommand,
  projectDoctorCommand,
  projectListCommand,
  projectRemoveCommand,
  projectSwitchCommand,
} from "./commands/project";

const program = new Command();
program
  .name("relay-baton")
  .description("Token-aware handoff harness for Codex CLI and Claude Code")
  .version("1.9.0-alpha.0");

function addProjectOptions(cmd: Command): Command {
  return cmd
    .option("--project <name-or-id>", "registered project name or id")
    .option("--path <repoPath>", "repository path");
}

addProjectOptions(program.command("init").description("Initialize .ai-session in the current repository")).action(initCommand);
addProjectOptions(program.command("doctor").description("Check local environment").option("--deep", "run extended diagnostics")).action(doctorCommand);
addProjectOptions(program.command("status").description("Show current session status").option("--json", "print machine-readable JSON")).action(statusCommand);

addProjectOptions(
  program
    .command("review")
    .description("Deterministically review the working-tree diff against the current plan (no model call)")
    .option("--json", "print machine-readable JSON"),
).action(reviewCommand);

addProjectOptions(
  program
    .command("verify")
    .description("Simulated end-to-end check of the relay-baton pipeline (no real model calls)")
    .option("--diet <profile>", "diet profile: off|lite|balanced|caveman|ultra")
    .option("--real-agents", "EXPERIMENTAL scaffold only; never executes real agents")
    .option("--keep-temp", "keep the throwaway temp repo used for the handoff check")
    .option("--verbose", "print per-step detail")
).action(verifyCommand);

program
  .command("run")
  .description("Run Codex CLI first; on fallback, run Claude Code with a handoff")
  .argument("<task>", "task description")
  .option("--diet <profile>", "diet profile: off|lite|balanced|caveman|ultra")
  .option("--force", "ignore quality gate failures")
  .option("--allow-api-key-env", "allow passing API key env vars to child processes")
  .option("--project <name-or-id>", "registered project name or id")
  .option("--path <repoPath>", "repository path")
  .action((task, opts) => runCommand(task, opts));

const handoff = program
  .command("handoff")
  .description("Generate a handoff and optionally launch the next agent")
  .option("--to <agent>", "next agent (claude)")
  .option("--diet <profile>", "diet profile: off|lite|balanced|caveman|ultra")
  .option("--force", "ignore quality gate failures")
  .option("--no-run", "do not launch the next agent")
  .option("--allow-api-key-env", "allow passing API key env vars to child processes")
  .option("--project <name-or-id>", "registered project name or id")
  .option("--path <repoPath>", "repository path")
  .action((opts) => {
    if (!opts.to) {
      console.error("[relay-baton] missing required option: --to <agent>");
      process.exit(2);
    }
    return handoffCommand(opts);
  });

handoff
  .command("history")
  .description("List past handoff documents (current + timestamped backups)")
  .option("--project <name-or-id>", "registered project name or id")
  .option("--path <repoPath>", "repository path")
  .action(handoffHistoryCommand);

handoff
  .command("show")
  .description("Print a handoff document read-only (current handoff.md by default)")
  .option("--file <name>", "a history file name from `handoff history` instead of the current one")
  .option("--json", "print machine-readable JSON")
  .option("--project <name-or-id>", "registered project name or id")
  .option("--path <repoPath>", "repository path")
  .action(handoffShowCommand);

handoff
  .command("bundle")
  .description("Build a portable handoff bundle (curated artifacts + git summary + redaction pass). Read-only on the repo")
  .option("--json", "print machine-readable JSON")
  .option("--dry-run", "show what would be bundled without writing")
  .option("--out <dir>", "bundle root directory (default: ~/.relay-baton/handoff-bundles)")
  .option("--project <name-or-id>", "registered project name or id")
  .option("--path <repoPath>", "repository path")
  .action(handoffBundleCommand);

handoff
  .command("inspect")
  .description("Validate a handoff bundle and print what it contains (read-only, applies nothing)")
  .argument("<bundle>", "bundle id or path under the bundle root")
  .option("--json", "print machine-readable JSON")
  .option("--out <dir>", "bundle root directory (default: ~/.relay-baton/handoff-bundles)")
  .action(handoffInspectCommand);

addProjectOptions(
  program
    .command("report")
    .description("Generate a human-readable markdown status report from existing artifacts (read-only, no model call)")
    .option("--out <file>", "write the report to a file instead of stdout")
    .option("--json", "wrap the markdown in JSON"),
).action(reportCommand);

program
  .command("plan")
  .description("Plan-execute mode: a planner agent writes .ai-session/plan.md")
  .argument("<task>", "task description")
  .option("--diet <profile>", "diet profile: off|lite|balanced|caveman|ultra")
  .option("--with <agent>", "planner agent (default: config planExecute.defaultPlanner)")
  .option("--planner <agent>", "planner agent (alias of --with)")
  .option("--executor <agent>", "executor agent for --then-execute")
  .option("--no-run", "scaffold an empty plan template instead of launching the planner")
  .option("--then-execute", "run the execute phase immediately after a passing plan")
  .option("--force", "ignore plan quality gate failures")
  .option("--allow-api-key-env", "allow passing API key env vars to child processes")
  .option("--project <name-or-id>", "registered project name or id")
  .option("--path <repoPath>", "repository path")
  .action((task, opts) => planCommand(task, opts));

program
  .command("execute")
  .description("Plan-execute mode: an executor agent implements .ai-session/plan.md")
  .option("--diet <profile>", "diet profile: off|lite|balanced|caveman|ultra")
  .option("--with <agent>", "executor agent (default: config planExecute.defaultExecutor)")
  .option("--from <path>", "read the plan from a custom path")
  .option("--force", "ignore quality gate failures")
  .option("--allow-api-key-env", "allow passing API key env vars to child processes")
  .option("--project <name-or-id>", "registered project name or id")
  .option("--path <repoPath>", "repository path")
  .action(executeCommand);

program
  .command("compact")
  .description("Recompute compact-state, repo-map, diff snapshot")
  .option("--diet <profile>", "diet profile: off|lite|balanced|caveman|ultra")
  .option("--project <name-or-id>", "registered project name or id")
  .option("--path <repoPath>", "repository path")
  .action(compactCommand);

program
  .command("squeeze")
  .description("Alias of compact")
  .option("--diet <profile>", "diet profile: off|lite|balanced|caveman|ultra")
  .option("--project <name-or-id>", "registered project name or id")
  .option("--path <repoPath>", "repository path")
  .action(compactCommand);

addProjectOptions(program.command("budget").description("Show context budget usage").option("--json", "print machine-readable JSON")).action(budgetCommand);

const receipt = program.command("receipt").description("Append-only execution receipts for plan steps");
addProjectOptions(receipt.command("done").description("Mark a plan step done").argument("<step>", "1-based step index").option("--note <text>", "short note")).action((step, opts) => receiptDoneCommand(step, opts));
addProjectOptions(receipt.command("skip").description("Mark a plan step skipped").argument("<step>", "1-based step index").option("--note <text>", "short note")).action((step, opts) => receiptSkipCommand(step, opts));
addProjectOptions(receipt.command("list").description("List recorded receipts").option("--json", "print machine-readable JSON")).action(receiptListCommand);

const checkpoint = program
  .command("checkpoint")
  .description("Append-only execution checkpoints (command, changed files, git, budget, result) per step");
addProjectOptions(
  checkpoint
    .command("add")
    .description("Record an execution checkpoint for a step")
    .argument("<step>", "1-based step index")
    .option("--command <text>", "command preview this step ran")
    .option("--result <result>", "step result: ok|fail|pending (default: pending)")
    .option("--note <text>", "short note")
    .option("--json", "print machine-readable JSON"),
).action((step, opts) => checkpointCommand(step, opts));
addProjectOptions(
  checkpoint.command("list").description("List recorded execution checkpoints").option("--json", "print machine-readable JSON"),
).action(checkpointListCommand);
addProjectOptions(
  checkpoint.command("summary").description("Compact execution receipt derived from checkpoints").option("--json", "print machine-readable JSON"),
).action(checkpointSummaryCommand);

addProjectOptions(
  program
    .command("guard")
    .description("Evaluate stop-condition guardrails against checkpoints + live git/budget (advisory, read-only)")
    .option("--json", "print machine-readable JSON")
    .option("--exit-code", "exit non-zero (10) when a stop condition is triggered"),
).action(guardCommand);

addProjectOptions(
  program
    .command("risk")
    .description("Flag risky surfaces in the working tree (deps, deletions, release/CI, env/config, binaries). Read-only")
    .option("--json", "print machine-readable JSON"),
).action(riskCommand);

addProjectOptions(
  program
    .command("workspace")
    .description("Deterministic workspace map: package managers, languages, monorepo packages, scripts, entry points, docs. Read-only")
    .option("--json", "print machine-readable JSON"),
).action(workspaceCommand);

addProjectOptions(
  program
    .command("profile")
    .description("Deterministic project profile hints: framework tags, recommended build/test, diet/agents, entry points. Read-only")
    .option("--json", "print machine-readable JSON"),
).action(profileCommand);

addProjectOptions(
  program
    .command("inventory")
    .description("Bounded inventory: package scripts, workspace packages, CI workflows, release files. Read-only")
    .option("--json", "print machine-readable JSON"),
).action(inventoryCommand);

program
  .command("compress-context")
  .description("Compress running session context (state.md / commands.log) when over budget")
  .option("--diet <profile>", "diet profile: off|lite|balanced|caveman|ultra")
  .option("--threshold <ratio>", "compress when weight/budget exceeds this ratio (0..1)")
  .option("--dry-run", "report what would change without writing")
  .option("--force", "compress regardless of threshold")
  .option("--project <name-or-id>", "registered project name or id")
  .option("--path <repoPath>", "repository path")
  .action(compressContextCommand);

program
  .command("compress")
  .description("Deterministically compress a markdown/instruction file")
  .argument("<file>")
  .option("--write", "rewrite file in place")
  .option("--out <path>", "write to a different path")
  .action(compressCommand);

program
  .command("login")
  .description("Run Codex / Claude Code CLI login flows interactively")
  .argument("[agent]", "codex | claude | all (default: all)")
  .option("--allow-api-key-env", "allow passing API key env vars to login process")
  .action((agent, opts) => loginCommand(agent, opts));

const project = program.command("project").description("Manage registered projects");
project.command("add").argument("<path>", "repository path").option("--name <name>").option("--diet <profile>").option("--primary <agent>").option("--fallback <agent>").option("--json", "print machine-readable JSON").action(projectAddCommand);
project.command("list").description("List registered projects").option("--json", "print machine-readable JSON").action(projectListCommand);
project.command("switch").argument("<name-or-id>").description("Switch active project").action(projectSwitchCommand);
project.command("current").description("Show active project").option("--json", "print machine-readable JSON").action(projectCurrentCommand);
project.command("remove").argument("<name-or-id>").description("Remove a project").option("--json", "print machine-readable JSON").action(projectRemoveCommand);
project.command("doctor").description("Check registered projects").action(projectDoctorCommand);

const git = program.command("git").description("Read-only git tracking helpers");
git
  .command("status")
  .description("Show branch, ahead/behind, and working-tree change counts")
  .option("--json", "print machine-readable JSON")
  .option("--limit <n>", "max changed files to include")
  .option("--project <name-or-id>", "registered project name or id")
  .option("--path <repoPath>", "repository path")
  .action(gitStatusCommand);

const session = program.command("session").description("Manage session archives and recovery");
session
  .command("archive")
  .description("Archive the current .ai-session artifacts without modifying the source repo")
  .option("--json", "print machine-readable JSON")
  .option("--dry-run", "show what would be archived without writing")
  .option("--out <dir>", "archive root directory (default: ~/.relay-baton/session-archives)")
  .option("--project <name-or-id>", "registered project name or id")
  .option("--path <repoPath>", "repository path")
  .action(sessionArchiveCommand);
session
  .command("list")
  .description("List archived sessions (read-only)")
  .option("--json", "print machine-readable JSON")
  .option("--out <dir>", "archive root directory (default: ~/.relay-baton/session-archives)")
  .action(sessionListCommand);
session
  .command("inspect")
  .description("Validate an archived session's manifest and file integrity (read-only)")
  .argument("<archive>", "archive id or path under the archive root")
  .option("--json", "print machine-readable JSON")
  .option("--out <dir>", "archive root directory (default: ~/.relay-baton/session-archives)")
  .action(sessionInspectCommand);
session
  .command("resume")
  .description("Diagnose the current .ai-session and suggest the safest next command (read-only)")
  .option("--json", "print machine-readable JSON")
  .option("--stale-hours <n>", "treat the session as stale when older than N hours (default: 24)")
  .option("--project <name-or-id>", "registered project name or id")
  .option("--path <repoPath>", "repository path")
  .action(sessionResumeCommand);

addProjectOptions(program.command("tui").description("Start the relay-baton TUI")).action(tuiCommand);

addProjectOptions(
  program
    .command("chat")
    .aliases(["room"])
    .description("Agent Room (v0.8 first cut): turn-based, confirmation-first multi-agent REPL")
    .option("--allow-api-key-env", "allow passing API key env vars to confirmed agent runs"),
).action(chatCommand);

addProjectOptions(
  program
    .command("replay")
    .description("Replay the recorded conversation timeline (read-only, no model call)")
    .option("--json", "print machine-readable JSON")
    .option("--session <id>", "filter to a single session id")
    .option("--kind <kinds>", "comma-separated event kinds to include")
    .option("--limit <n>", "keep only the most recent N events"),
).action(replayCommand);

const conversation = program.command("conversation").description("Append/read Agent Room conversation events");
addProjectOptions(
  conversation
    .command("append")
    .description("Append a single conversation event to the current session")
    .argument("<text>", "event text")
    .option("--json", "print machine-readable JSON")
    .option("--role <role>", "event role: user|relay-baton|codex|claude")
    .option("--kind <kind>", "event kind, e.g. message|command|status|budget|prompt_preview"),
).action((text, opts) => conversationAppendCommand(text, opts));

program.parseAsync(process.argv).catch(err => {
  console.error(err?.stack ?? err);
  process.exit(1);
});

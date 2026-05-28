#!/usr/bin/env node
import { Command } from "commander";
import { initCommand } from "./commands/init";
import { doctorCommand } from "./commands/doctor";
import { statusCommand } from "./commands/status";
import { runCommand } from "./commands/run";
import { handoffCommand } from "./commands/handoff";
import { handoffHistoryCommand } from "./commands/handoffHistory";
import { planCommand } from "./commands/plan";
import { executeCommand } from "./commands/execute";
import { compressContextCommand } from "./commands/compressContext";
import { compactCommand } from "./commands/compact";
import { budgetCommand } from "./commands/budget";
import { compressCommand } from "./commands/compress";
import { tuiCommand } from "./commands/tui";
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
  .version("0.4.0");

function addProjectOptions(cmd: Command): Command {
  return cmd
    .option("--project <name-or-id>", "registered project name or id")
    .option("--path <repoPath>", "repository path");
}

addProjectOptions(program.command("init").description("Initialize .ai-session in the current repository")).action(initCommand);
addProjectOptions(program.command("doctor").description("Check local environment")).action(doctorCommand);
addProjectOptions(program.command("status").description("Show current session status")).action(statusCommand);

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

addProjectOptions(program.command("budget").description("Show context budget usage")).action(budgetCommand);

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
project.command("add").argument("<path>", "repository path").option("--name <name>").option("--diet <profile>").option("--primary <agent>").option("--fallback <agent>").action(projectAddCommand);
project.command("list").description("List registered projects").action(projectListCommand);
project.command("switch").argument("<name-or-id>").description("Switch active project").action(projectSwitchCommand);
project.command("current").description("Show active project").action(projectCurrentCommand);
project.command("remove").argument("<name-or-id>").description("Remove a project").action(projectRemoveCommand);
project.command("doctor").description("Check registered projects").action(projectDoctorCommand);

addProjectOptions(program.command("tui").description("Start the relay-baton TUI")).action(tuiCommand);

program.parseAsync(process.argv).catch(err => {
  console.error(err?.stack ?? err);
  process.exit(1);
});

import * as readline from "readline";
import {
  ConfigLoader, SessionManager, GitService, RoomEngine, PromptBuilder,
} from "@relay-baton/core";
import type { RoomAction, RunCommand } from "@relay-baton/core";
import type { AgentId } from "@relay-baton/shared";
import { ProjectOpts, resolveProjectContext } from "./projectOptions";
import { adapterFor } from "./agentFor";
import { reviewCommand } from "./review";
import { budgetCommand } from "./budget";
import { statusCommand } from "./status";
import { planCommand } from "./plan";
import { executeCommand } from "./execute";
import { handoffCommand } from "./handoff";

export interface ChatOpts extends ProjectOpts {
  allowApiKeyEnv?: boolean;
}

const LABELS: Record<string, string> = {
  user: "you",
  claude: "claude",
  codex: "codex",
  "relay-baton": "relay-baton",
};

function say(role: string, text: string) {
  console.log(`[${LABELS[role] ?? role}] ${text}`);
}

/**
 * Build a model-free prompt PREVIEW for a run-type command. This shows exactly
 * what would be spawned; it never executes. Confirmation-first by design.
 */
function buildPreview(command: RunCommand, args: string, agent: AgentId, repoRoot: string, sessionDir: string, config: any): string | null {
  if (command === "plan") {
    const prompt = PromptBuilder.planner(args);
    const c = adapterFor(agent, config).buildCommand({ task: prompt, prompt, repoRoot, sessionDir });
    return `${c.command} ${c.args.slice(0, -1).join(" ")} "<planner prompt, ${prompt.length} chars>"`;
  }
  if (command === "execute") {
    const prompt = PromptBuilder.executor();
    const c = adapterFor(agent, config).buildCommand({ task: prompt, prompt, repoRoot, sessionDir });
    return `${c.command} ${c.args.slice(0, -1).join(" ")} "<executor prompt, ${prompt.length} chars>"`;
  }
  if (command === "handoff") {
    return `relay-baton handoff --to ${agent} (builds handoff.md, then launches ${agent})`;
  }
  return null;
}

function ask(rl: readline.Interface, q: string): Promise<string> {
  return new Promise(resolve => rl.question(q, a => resolve(a)));
}

export async function chatCommand(opts: ChatOpts = {}) {
  const projectContext = resolveProjectContext(opts, true);
  const repoRoot = projectContext.repoRoot;
  const { config } = ConfigLoader.load(repoRoot);
  const sm = new SessionManager(repoRoot, config);
  if (!sm.getMeta()) sm.init("");
  const sessionId = sm.getMeta()?.id;
  const sessionDir = sm.files.dir;

  const git = new GitService(repoRoot);
  if (!git.isGitRepo()) {
    console.error("[relay-baton] not a git repository. aborting.");
    process.exit(2);
  }

  const engine = new RoomEngine(repoRoot, sessionId, "claude");

  console.log("relay-baton room (v0.8 first cut). Turn-based, confirmation-first.");
  console.log("This is NOT a realtime autopilot — every real agent run asks first.");
  console.log("Type /help for commands, /exit to leave.\n");
  say("relay-baton", `addressing ${engine.currentAgent} (planner/reviewer = claude, executor = codex).`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const passthrough = {
    project: opts.project,
    path: opts.path,
    allowApiKeyEnv: opts.allowApiKeyEnv,
  };

  let running = true;
  while (running) {
    const line = await ask(rl, `\n${engine.currentAgent}› `);
    const action: RoomAction = engine.handle(line);
    switch (action.kind) {
      case "noop":
        break;
      case "exit":
        running = false;
        break;
      case "help":
        console.log("commands:\n" + action.text);
        break;
      case "error":
        say("relay-baton", action.message);
        break;
      case "switch-agent":
        say("relay-baton", `now addressing ${action.agent}.`);
        break;
      case "chat":
        // Confirmation-first: a plain message is recorded but never auto-runs an
        // agent. The user drives real work with explicit slash commands.
        say("relay-baton", `noted (logged to conversation.jsonl). Use /plan, /execute, /review, or /handoff to act with ${action.agent}.`);
        break;
      case "run": {
        await runAction(action, rl, { repoRoot, sessionDir, config, passthrough });
        break;
      }
    }
  }

  rl.close();
  console.log("\n[relay-baton] left the room.");
}

async function runAction(
  action: Extract<RoomAction, { kind: "run" }>,
  rl: readline.Interface,
  ctx: { repoRoot: string; sessionDir: string; config: any; passthrough: any },
) {
  const { command, args, agent } = action;

  // Read-only / no-model commands run immediately.
  if (command === "review") return void (await reviewCommand({ ...ctx.passthrough }));
  if (command === "budget") return void (await budgetCommand({ ...ctx.passthrough }));
  if (command === "status") return void (await statusCommand({ ...ctx.passthrough }));

  // Real agent runs: show a prompt preview, then require explicit confirmation.
  const preview = buildPreview(command, args, agent, ctx.repoRoot, ctx.sessionDir, ctx.config);
  say("relay-baton", `prompt preview for /${command} (${agent}):`);
  console.log("  " + (preview ?? "(no preview available)"));
  const answer = (await ask(rl, "  run this? [y/N] ")).trim().toLowerCase();
  if (answer !== "y" && answer !== "yes") {
    say("relay-baton", "cancelled. nothing ran.");
    return;
  }

  if (command === "plan") {
    await planCommand(args, { ...ctx.passthrough, with: agent });
  } else if (command === "execute") {
    await executeCommand({ ...ctx.passthrough, with: agent });
  } else if (command === "handoff") {
    await handoffCommand({ ...ctx.passthrough, to: agent });
  }
}

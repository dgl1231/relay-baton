import {
  ConfigLoader,
  createAgentEnv,
  safeSpawn,
  safeSpawnSync,
  AGENT_REGISTRY,
  ALL_AGENT_IDS,
  getAgentDescriptor,
  isAgentId,
} from "@relay-baton/core";
import type { AgentId } from "@relay-baton/shared";

function bin(cmd: string): boolean {
  const r = safeSpawnSync(cmd, ["--version"], { encoding: "utf8" });
  return r.error == null;
}

function header(title: string) {
  const line = "─".repeat(Math.max(8, title.length + 4));
  process.stdout.write(`\n\x1b[36m┌${line}┐\n│  \x1b[1m${title}\x1b[22m\x1b[36m  │\n└${line}┘\x1b[0m\n`);
}

async function spawnInteractive(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<number> {
  return new Promise((resolve) => {
    const child = safeSpawn(command, args, { stdio: "inherit", env, shell: false });
    child.on("error", (e: any) => {
      console.error(`\x1b[31m[relay-baton] failed to spawn ${command}: ${e?.message ?? e}\x1b[0m`);
      if (e?.code === "ENOENT") {
        console.error(`\x1b[33mInstall the ${command} CLI and ensure it is on PATH.\x1b[0m`);
      }
      resolve(127);
    });
    child.on("close", (code) => resolve(code ?? 0));
  });
}

/** Run the registry-described login flow for a single agent; returns 0 on success. */
async function loginAgent(id: AgentId, command: string, env: NodeJS.ProcessEnv): Promise<number> {
  const desc = getAgentDescriptor(id);
  header(`${desc.displayName} login  [${desc.tier}]`);

  if (!bin(command)) {
    console.error(`\x1b[31m✗ ${command} command not found on PATH.\x1b[0m`);
    console.error(`  Install ${desc.displayName} first: ${desc.installUrl}`);
    return 1;
  }

  for (const line of desc.login.instructions) console.log(`\x1b[2m${line}\x1b[0m`);

  // No login subcommand (e.g. Aider uses provider API keys via env) — instructions only.
  if (desc.login.kind === "env") {
    console.log(`\x1b[32m✓ ${desc.displayName}: nothing to run here (see above).\x1b[0m`);
    return 0;
  }

  const args = desc.login.kind === "subcommand" ? desc.login.subcommand ?? [] : [];
  const code = await spawnInteractive(command, args, env);
  // Interactive sessions exit non-zero on Ctrl+C (130) — treat as benign.
  if (code !== 0 && !(desc.login.kind === "interactive" && code === 130)) {
    console.error(`\x1b[31m✗ ${command} login exited with ${code}\x1b[0m`);
    return 1;
  }
  console.log(`\x1b[32m✓ ${desc.displayName} login finished. \`relay-baton doctor\`로 상태를 확인하세요.\x1b[0m`);
  return 0;
}

export async function loginCommand(agent: string | undefined, opts: { allowApiKeyEnv?: boolean }) {
  const which = agent ?? "all";
  if (which !== "all" && !isAgentId(which)) {
    console.error(`unknown agent: ${which}. Use one of: ${ALL_AGENT_IDS.join(", ")} | all`);
    process.exit(2);
  }

  const repoRoot = process.cwd();
  const { config } = ConfigLoader.load(repoRoot);
  const { env, removed } = createAgentEnv(process.env, config.authPolicy, opts.allowApiKeyEnv);

  if (removed.length > 0) {
    console.log(`\x1b[2m[relay-baton] blocked env from child: ${removed.join(", ")}\x1b[0m`);
  }

  // Default `all` logs in just the first-class pair (codex + claude); explicit
  // agent ids reach the supported adapters (opencode/gemini/aider/cursor).
  const targets: AgentId[] =
    which === "all"
      ? ALL_AGENT_IDS.filter((id) => AGENT_REGISTRY[id].tier === "first-class")
      : [which];

  let totalFail = 0;
  for (const id of targets) {
    const command = config.agents[id]?.command ?? AGENT_REGISTRY[id].command;
    totalFail += await loginAgent(id, command, env);
  }

  if (which === "all") {
    const supported = ALL_AGENT_IDS.filter((id) => AGENT_REGISTRY[id].tier === "supported");
    console.log(`\n\x1b[2m지원 어댑터 로그인: ${supported.map((s) => `relay-baton login ${s}`).join("  ·  ")}\x1b[0m`);
  }

  if (totalFail > 0) process.exit(1);
}

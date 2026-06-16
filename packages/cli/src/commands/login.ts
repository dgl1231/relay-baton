import { ConfigLoader, createAgentEnv, safeSpawn, safeSpawnSync } from "@relay-baton/core";

type Which = "codex" | "claude" | "all";

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

export async function loginCommand(agent: string | undefined, opts: { allowApiKeyEnv?: boolean }) {
  const which = (agent ?? "all") as Which;
  const repoRoot = process.cwd();
  const { config } = ConfigLoader.load(repoRoot);
  const { env, removed } = createAgentEnv(process.env, config.authPolicy, opts.allowApiKeyEnv);

  if (removed.length > 0) {
    console.log(`\x1b[2m[relay-baton] blocked env from child: ${removed.join(", ")}\x1b[0m`);
  }

  let totalFail = 0;

  if (which === "codex" || which === "all") {
    header("Codex CLI login");
    if (!bin("codex")) {
      console.error("\x1b[31m✗ codex command not found on PATH.\x1b[0m");
      console.error("  Install Codex CLI first: https://github.com/openai/codex");
      totalFail++;
    } else {
      console.log("\x1b[2m`codex login`을 실행합니다. 브라우저 인증을 마치면 자동으로 돌아옵니다.\x1b[0m");
      const code = await spawnInteractive("codex", ["login"], env);
      if (code !== 0) {
        console.error(`\x1b[31m✗ codex login exited with ${code}\x1b[0m`);
        totalFail++;
      } else {
        console.log("\x1b[32m✓ codex login finished.\x1b[0m");
      }
    }
  }

  if (which === "claude" || which === "all") {
    header("Claude Code login");
    if (!bin("claude")) {
      console.error("\x1b[31m✗ claude command not found on PATH.\x1b[0m");
      console.error("  Install Claude Code first: https://docs.claude.com/en/docs/agents-and-tools/claude-code/setup");
      totalFail++;
    } else {
      console.log("\x1b[2mClaude Code 대화형 세션을 엽니다.\x1b[0m");
      console.log("\x1b[2m1. 프롬프트가 뜨면  /login  을 입력하고 Enter.\x1b[0m");
      console.log("\x1b[2m2. 안내되는 브라우저 인증을 완료합니다.\x1b[0m");
      console.log("\x1b[2m3. 끝나면  /exit  또는 Ctrl+C 로 빠져나옵니다.\x1b[0m\n");
      const code = await spawnInteractive("claude", [], env);
      if (code !== 0 && code !== 130) {
        console.error(`\x1b[31m✗ claude exited with ${code}\x1b[0m`);
        totalFail++;
      } else {
        console.log("\x1b[32m✓ claude session ended. 다시 doctor로 상태를 확인해 보세요.\x1b[0m");
      }
    }
  }

  if (which !== "codex" && which !== "claude" && which !== "all") {
    console.error(`unknown agent: ${which}. Use codex | claude | all`);
    process.exit(2);
  }

  if (totalFail > 0) process.exit(1);
}

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { safeSpawnSync } from "@relay-baton/core";
import { ConfigLoader, SessionManager } from "@relay-baton/core";
import { PLAN_SECTIONS, planSectionBody } from "@relay-baton/core";
import { validateConfig, validateArtifacts, SchemaInspector } from "@relay-baton/core";
import type { RelayBatonConfig } from "@relay-baton/shared";
import { collectHandoffHistory } from "./handoffHistory";

export type CheckStatus = "ok" | "warn" | "fail" | "info";

export interface Check {
  status: CheckStatus;
  label: string;
  value: string;
}

/** Arguments that relay-baton must never pass to an agent (security / policy). */
export const DEPRECATED_AGENT_ARGS = [
  "--full-auto",
  "--ask-for-approval",
  "--dangerously-bypass-approvals-and-sandbox",
  "bypassPermissions",
];

/** Expected default adapter args (sanity baseline). */
export const EXPECTED_AGENT_ARGS: Record<string, string[]> = {
  codex: ["exec", "--sandbox", "workspace-write"],
  claude: ["--permission-mode", "acceptEdits", "-p"],
};

function toolVersion(cmd: string): string | null {
  const r = safeSpawnSync(cmd, ["--version"], { encoding: "utf8" });
  if (r.error != null) return null;
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim();
  return out.split(/\r?\n/)[0] || "available";
}

function readSafe(p: string): string {
  try { return fs.readFileSync(p, "utf8"); } catch { return ""; }
}

/**
 * Core checks shared by `doctor` and `verify`. Environment + agents + auth
 * presence, never printing secret values.
 */
export function coreChecks(repoRoot: string, cfg: RelayBatonConfig): Check[] {
  const checks: Check[] = [];

  const gitOk = fs.existsSync(path.join(repoRoot, ".git"));
  checks.push({ status: gitOk ? "ok" : "fail", label: "git repository", value: gitOk ? "yes" : "no (run inside a git repo)" });

  const gitV = toolVersion("git");
  checks.push({ status: gitV ? "ok" : "fail", label: "git command", value: gitV ?? "MISSING" });

  const codexCmd = cfg.agents.codex?.command ?? "codex";
  const claudeCmd = cfg.agents.claude?.command ?? "claude";
  const codexV = toolVersion(codexCmd);
  const claudeV = toolVersion(claudeCmd);
  checks.push({ status: codexV ? "ok" : "warn", label: "codex command", value: codexV ?? "missing — run `relay-baton login codex`" });
  checks.push({ status: claudeV ? "ok" : "warn", label: "claude command", value: claudeV ?? "missing — run `relay-baton login claude`" });

  // Auth: presence only, never values.
  for (const ev of cfg.authPolicy.blockedEnvVars) {
    const set = !!process.env[ev];
    if (set && !cfg.authPolicy.allowApiKeyEnv) {
      checks.push({ status: "warn", label: ev, value: "set — blocked by default (use --allow-api-key-env to pass through)" });
    } else {
      checks.push({ status: "info", label: ev, value: set ? "set (passed through)" : "not set" });
    }
  }

  const sm = new SessionManager(repoRoot, cfg);
  const hasSession = fs.existsSync(sm.files.dir);
  checks.push({ status: hasSession ? "ok" : "warn", label: ".ai-session", value: hasSession ? sm.files.dir : "missing — run `relay-baton init`" });

  return checks;
}

/** Extended diagnostics for `doctor --deep`. */
export function deepChecks(repoRoot: string, cfg: RelayBatonConfig): Check[] {
  const checks: Check[] = [];

  // Tooling versions.
  const node = process.version;
  const major = Number(node.replace(/^v/, "").split(".")[0]);
  checks.push({ status: major >= 20 ? "ok" : "warn", label: "node version", value: `${node}${major >= 20 ? "" : " (>=20 recommended)"}` });
  const pnpmV = toolVersion("pnpm");
  checks.push({ status: pnpmV ? "ok" : "info", label: "pnpm version", value: pnpmV ?? "not found (only needed for development)" });

  // Adapter args sanity.
  for (const [id, expected] of Object.entries(EXPECTED_AGENT_ARGS)) {
    const args = cfg.agents[id]?.args ?? [];
    const deprecated = args.filter(a => DEPRECATED_AGENT_ARGS.includes(a));
    if (deprecated.length > 0) {
      checks.push({ status: "fail", label: `${id} args`, value: `uses forbidden arg(s): ${deprecated.join(", ")}` });
    } else if (JSON.stringify(args) === JSON.stringify(expected)) {
      checks.push({ status: "ok", label: `${id} args`, value: args.join(" ") });
    } else {
      checks.push({ status: "warn", label: `${id} args`, value: `custom: ${args.join(" ") || "(empty)"} (default: ${expected.join(" ")})` });
    }
  }

  // .gitattributes / CRLF hints (Windows-relevant).
  const gaPath = path.join(repoRoot, ".gitattributes");
  const hasGa = fs.existsSync(gaPath);
  if (os.platform() === "win32") {
    checks.push({
      status: hasGa ? "ok" : "warn",
      label: ".gitattributes",
      value: hasGa ? "present (EOL normalization configured)" : "missing — add `* text=auto eol=lf` to avoid CRLF churn on Windows",
    });
  } else {
    checks.push({ status: "info", label: ".gitattributes", value: hasGa ? "present" : "absent (ok on this platform)" });
  }

  // Registry health.
  const registryPath = process.env.RELAY_BATON_PROJECTS_FILE
    ?? path.join(os.homedir(), ".relay-baton", "projects.json");
  if (fs.existsSync(registryPath)) {
    try {
      const data = JSON.parse(readSafe(registryPath));
      const count = Array.isArray(data?.projects) ? data.projects.length : 0;
      checks.push({ status: "ok", label: "project registry", value: `${count} project(s) — ${registryPath}` });
    } catch {
      checks.push({ status: "fail", label: "project registry", value: `unparseable JSON — ${registryPath}` });
    }
  } else {
    checks.push({ status: "info", label: "project registry", value: "none (cwd-based mode)" });
  }

  // Config contract validation (v1.0 frozen schema).
  {
    const r = validateConfig(cfg);
    checks.push({
      status: r.ok ? "ok" : "fail",
      label: "config contract",
      value: r.ok ? `valid (v${cfg.configVersion ?? "?"})` : r.errors.join("; "),
    });
    for (const w of r.warnings) {
      checks.push({ status: "warn", label: "config contract", value: w });
    }
  }

  // .ai-session artifact shape validation (v1.0 frozen artifacts).
  {
    const report = validateArtifacts(repoRoot);
    if (!report.exists) {
      checks.push({ status: "info", label: "artifact shapes", value: "no .ai-session yet" });
    } else {
      for (const c of report.checks) {
        const status: CheckStatus =
          c.status === "absent" ? "info" : c.status === "warn" ? "warn" : c.status === "fail" ? "fail" : "ok";
        checks.push({ status, label: `artifact: ${c.file}`, value: c.detail });
      }
    }
  }

  // .ai-session artifact schema versions (v2.0 migration checks).
  {
    const schema = new SchemaInspector(repoRoot).inspect();
    if (!schema.exists) {
      checks.push({ status: "info", label: "artifact schemas", value: "no .ai-session yet" });
    } else {
      for (const c of schema.checks) {
        if (c.status === "absent") continue;
        const status: CheckStatus =
          c.status === "ok" ? "ok" : c.status === "ahead" || c.status === "unreadable" ? "fail" : "warn";
        const found = c.foundVersion == null ? "-" : `v${c.foundVersion}`;
        checks.push({ status, label: `schema: ${c.file}`, value: `${c.status} (${found}/v${c.currentVersion})` });
      }
      if (schema.migratable) {
        checks.push({ status: "info", label: "migration", value: "run `relay-baton migrate --check` for guidance" });
      }
    }
  }

  // .ai-session health.
  const sm = new SessionManager(repoRoot, cfg);
  if (fs.existsSync(sm.files.dir)) {
    const meta = sm.getMeta();
    checks.push({ status: meta ? "ok" : "warn", label: "session.json", value: meta ? `status=${meta.status} agent=${meta.activeAgent}` : "missing or unreadable" });

    // Latest handoff + budget.
    const history = collectHandoffHistory(repoRoot);
    const current = history.find(h => h.current);
    if (current) {
      const activeProfile = meta?.tokenDietProfile ?? cfg.tokenDiet.profile;
      const max = cfg.tokenDiet.profiles[activeProfile]?.maxHandoffChars ?? 0;
      const over = max > 0 && current.size > max;
      checks.push({ status: over ? "warn" : "ok", label: "latest handoff", value: `${current.size}B / ${max} budget (${activeProfile})${over ? " — over budget" : ""}` });
    } else {
      checks.push({ status: "info", label: "latest handoff", value: "none yet" });
    }

    // plan.md status.
    const planMd = readSafe(sm.files.p("plan"));
    if (planMd.trim().length > 0) {
      const missing = PLAN_SECTIONS.filter(s => planSectionBody(planMd, s).length === 0);
      checks.push({
        status: missing.length === 0 ? "ok" : "warn",
        label: "plan.md",
        value: missing.length === 0 ? `present (${PLAN_SECTIONS.length} sections)` : `present, empty sections: ${missing.join(", ")}`,
      });
    } else {
      checks.push({ status: "info", label: "plan.md", value: "none" });
    }

    // compress-context status (rotated raw artifacts).
    const rotated = fs.existsSync(sm.files.dir)
      ? fs.readdirSync(sm.files.dir).filter(n => n.startsWith("commands.log.full."))
      : [];
    checks.push({
      status: "info",
      label: "compress-context",
      value: rotated.length > 0 ? `${rotated.length} rotated log(s) — last compression occurred` : "no rotations yet",
    });
  } else {
    checks.push({ status: "info", label: ".ai-session contents", value: "not initialized" });
  }

  return checks;
}

export function loadConfig(repoRoot: string) {
  return ConfigLoader.load(repoRoot);
}

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// packages/cli/src/__tests__ -> repo root is four levels up.
const repoRoot = path.resolve(__dirname, "..", "..", "..", "..");

function read(rel: string): string {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

describe("v0.6 docs", () => {
  it("ships docs/ROADMAP.md covering v0.6 through v1.0", () => {
    const roadmap = read("docs/ROADMAP.md");
    for (const v of ["v0.6", "v0.7", "v0.8", "v0.9", "v1.0"]) {
      expect(roadmap).toContain(v);
    }
    expect(roadmap).toMatch(/Trust\s*&?\s*Verify/i);
  });

  it("ships release-notes/v0.6.0.md with the Trust & Verify theme", () => {
    const notes = read("release-notes/v0.6.0.md");
    expect(notes).toMatch(/Trust\s*&?\s*Verify/i);
    expect(notes).toMatch(/doctor --deep/);
    expect(notes).toMatch(/\bverify\b/);
  });

  it("ships a Korean release note for v0.6.0", () => {
    const ko = read("release-notes/ko/v0.6.0.md");
    expect(ko).toMatch(/verify/);
    expect(ko).toMatch(/doctor --deep/);
  });

  it("ships docs/AGENT_ROOM.md and links it from the README", () => {
    const room = read("docs/AGENT_ROOM.md");
    expect(room).toMatch(/Agent Room/i);
    expect(room).toMatch(/conversation\.jsonl/);
    const readme = read("README.md");
    expect(readme).toMatch(/Agent Room \/ Conversation Mode/i);
    expect(readme).toContain("docs/AGENT_ROOM.md");
  });

  it("ships release-notes/v0.7.0.md (EN + KO) with the Review & Diagnose theme", () => {
    const notes = read("release-notes/v0.7.0.md");
    expect(notes).toMatch(/Review\s*&?\s*Diagnose/i);
    expect(notes).toMatch(/relay-baton review/);
    expect(notes).toMatch(/receipt/);
    const ko = read("release-notes/ko/v0.7.0.md");
    expect(ko).toMatch(/Review\s*&?\s*Diagnose/i);
    expect(ko).toMatch(/receipt/);
  });

  it("ships release-notes/v0.8.0.md (EN + KO) with the Agent Room first cut", () => {
    const notes = read("release-notes/v0.8.0.md");
    expect(notes).toMatch(/Agent Room/i);
    expect(notes).toMatch(/relay-baton chat/);
    expect(notes).toMatch(/OpenCode|Gemini|Aider/);
    const ko = read("release-notes/ko/v0.8.0.md");
    expect(ko).toMatch(/Agent Room/i);
    expect(ko).toMatch(/relay-baton chat/);
  });

  it("ships release-notes/v0.9.0.md (EN + KO) with the bounded automation theme", () => {
    const notes = read("release-notes/v0.9.0.md");
    expect(notes).toMatch(/Automation\s*&?\s*Runtime/i);
    expect(notes).toMatch(/relay-baton replay/);
    expect(notes).toMatch(/--max-steps/);
    const ko = read("release-notes/ko/v0.9.0.md");
    expect(ko).toMatch(/Automation\s*&?\s*Runtime/i);
    expect(ko).toMatch(/--max-steps/);
  });

  it("documents replay and bounded continue in the README", () => {
    const readme = read("README.md");
    expect(readme).toMatch(/relay-baton replay/);
    expect(readme).toMatch(/continue/);
  });

  it("documents the chat/room command and adapter scaffolds in the README", () => {
    const readme = read("README.md");
    expect(readme).toMatch(/relay-baton chat/);
    expect(readme).toMatch(/room/);
  });

  it("documents the plan/execute/compress-context workflow in the root README", () => {
    const readme = read("README.md");
    expect(readme).toMatch(/relay-baton plan/);
    expect(readme).toMatch(/relay-baton execute/);
    expect(readme).toMatch(/compress-context/);
    expect(readme).toMatch(/relay-baton verify/);
  });
});

describe("v1.0 docs", () => {
  it("ships docs/ARTIFACTS.md documenting the .ai-session stability contract", () => {
    const artifacts = read("docs/ARTIFACTS.md");
    expect(artifacts).toMatch(/CONFIG_VERSION/);
    expect(artifacts).toMatch(/SESSION_SCHEMA_VERSION/);
    expect(artifacts).toMatch(/session\.json/);
    expect(artifacts).toMatch(/conversation\.jsonl/);
    expect(artifacts).toMatch(/validateArtifacts/);
  });

  it("ships a full command reference (EN + KO) covering every top-level command", () => {
    const cmds = read("docs/COMMANDS.md");
    const ko = read("docs/i18n/COMMANDS.ko.md");
    const commands = [
      "init", "status", "doctor", "verify", "login", "run", "handoff",
      "plan", "execute", "receipt", "compact", "compress-context",
      "compress", "budget", "chat", "replay", "review", "project", "tui",
    ];
    for (const c of commands) {
      expect(cmds).toContain(c);
      expect(ko).toContain(c);
    }
    expect(cmds).toMatch(/--allow-api-key-env/);
    expect(ko).toMatch(/--allow-api-key-env/);
  });

  it("documents the stabilized Agent Room command set including /diagnose", () => {
    const room = read("docs/AGENT_ROOM.md");
    for (const c of ["/plan", "/replan", "/execute", "/continue", "/review", "/diagnose", "/handoff", "/replay"]) {
      expect(room).toContain(c);
    }
  });
});

describe("v2.0 docs", () => {
  it("ships a consolidated public guide (EN + KO) covering install, workflows, and safety", () => {
    for (const rel of ["docs/GUIDE.md", "docs/i18n/GUIDE.ko.md"]) {
      const g = read(rel);
      expect(g).toMatch(/install/i);
      expect(g).toMatch(/quickstart|빠른 시작/i);
      expect(g).toMatch(/desktop|데스크톱/i);
      expect(g).toMatch(/safety|안전/i);
      expect(g).toMatch(/migrate/);
    }
  });

  it("documents the finalized distribution & update policy in RELEASE.md", () => {
    const r = read("docs/RELEASE.md");
    expect(r).toMatch(/[Ff]inalized distribution/);
    expect(r).toMatch(/SHA256SUMS/);
    expect(r).toMatch(/SBOM/);
    expect(r).toMatch(/updater/i);
  });

  it("has no unresolved <your-org> placeholders in user-facing docs", () => {
    for (const rel of ["README.md", "install/install.md", "docs/GUIDE.md", "docs/i18n/GUIDE.ko.md"]) {
      expect(read(rel)).not.toContain("your-org");
    }
  });
});

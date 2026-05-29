import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { SESSION_DIR, SESSION_FILES, SESSION_SCHEMA_VERSION } from "@relay-baton/shared";
import { validateArtifacts } from "../session/ArtifactValidator";

let root: string;

function sdir() { return path.join(root, SESSION_DIR); }
function write(name: keyof typeof SESSION_FILES, content: string) {
  fs.writeFileSync(path.join(sdir(), SESSION_FILES[name]), content, "utf8");
}

function goodMeta() {
  return {
    schemaVersion: SESSION_SCHEMA_VERSION,
    id: "s1",
    createdAt: "2026-05-29T00:00:00Z",
    updatedAt: "2026-05-29T00:00:00Z",
    repoRoot: root,
    task: "do x",
    status: "initialized",
    primaryAgent: "codex",
    fallbackAgent: "claude",
    activeAgent: "none",
    lastAgent: "none",
    fallbackReason: null,
    lastError: null,
    tokenDietProfile: "balanced",
  };
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "rb-artifacts-"));
  fs.mkdirSync(sdir(), { recursive: true });
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("validateArtifacts", () => {
  it("returns ok with no checks when .ai-session is absent", () => {
    fs.rmSync(sdir(), { recursive: true, force: true });
    const r = validateArtifacts(root);
    expect(r.exists).toBe(false);
    expect(r.ok).toBe(true);
    expect(r.checks).toEqual([]);
  });

  it("passes a well-formed session", () => {
    write("sessionJson", JSON.stringify(goodMeta()));
    write("contextBudget", "{}");
    write("conversation", JSON.stringify({ kind: "note" }) + "\n");
    const r = validateArtifacts(root);
    expect(r.ok).toBe(true);
    expect(r.checks.find(c => c.artifact === "sessionJson")?.status).toBe("ok");
    expect(r.checks.find(c => c.artifact === "contextBudget")?.status).toBe("ok");
    expect(r.checks.find(c => c.artifact === "conversation")?.status).toBe("ok");
  });

  it("fails on unparseable session.json", () => {
    write("sessionJson", "{not json");
    const r = validateArtifacts(root);
    expect(r.ok).toBe(false);
    expect(r.checks.find(c => c.artifact === "sessionJson")?.status).toBe("fail");
  });

  it("fails when session.json violates the SessionMeta contract", () => {
    const m = goodMeta();
    (m as any).status = "weird";
    write("sessionJson", JSON.stringify(m));
    const r = validateArtifacts(root);
    expect(r.ok).toBe(false);
    expect(r.checks.find(c => c.artifact === "sessionJson")?.status).toBe("fail");
  });

  it("warns on empty context-budget.json", () => {
    write("contextBudget", "   ");
    const r = validateArtifacts(root);
    expect(r.checks.find(c => c.artifact === "contextBudget")?.status).toBe("warn");
    expect(r.ok).toBe(true);
  });

  it("fails on malformed conversation.jsonl lines", () => {
    write("conversation", JSON.stringify({ ok: 1 }) + "\nnot-json\n");
    const r = validateArtifacts(root);
    expect(r.ok).toBe(false);
    const c = r.checks.find(c => c.artifact === "conversation");
    expect(c?.status).toBe("fail");
    expect(c?.detail).toMatch(/1\/2/);
  });

  it("marks absent artifacts without failing", () => {
    const r = validateArtifacts(root);
    expect(r.ok).toBe(true);
    expect(r.checks.every(c => c.status === "absent")).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { SessionManager, defaultConfig } from "../index";
import { ExecutionCheckpoints } from "../plan/ExecutionCheckpoints";
import { SchemaInspector } from "../session/SchemaInspector";
import { SchemaMigrator } from "../session/SchemaMigrator";

function legacyRepo(): string {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "rb-migrator-"));
  new SessionManager(repo, defaultConfig).init("migrate test");
  // strip schemaVersion from session.json to simulate a legacy artifact
  const p = path.join(repo, ".ai-session", "session.json");
  const meta = JSON.parse(fs.readFileSync(p, "utf8"));
  delete meta.schemaVersion;
  fs.writeFileSync(p, JSON.stringify(meta));
  return repo;
}

describe("SchemaMigrator", () => {
  it("dry-run reports the plan without writing", () => {
    const repo = legacyRepo();
    const before = fs.readFileSync(path.join(repo, ".ai-session", "session.json"), "utf8");
    const result = new SchemaMigrator(repo).migrate({ dryRun: true });
    expect(result.dryRun).toBe(true);
    expect(result.actions.some(a => a.artifact === "sessionJson" && a.kind === "normalize-legacy")).toBe(true);
    expect(result.actions.every(a => !a.applied)).toBe(true);
    expect(result.backups).toHaveLength(0);
    expect(fs.readFileSync(path.join(repo, ".ai-session", "session.json"), "utf8")).toBe(before);
  });

  it("apply normalizes legacy session.json and writes a backup", () => {
    const repo = legacyRepo();
    const result = new SchemaMigrator(repo).migrate({ dryRun: false });
    expect(result.actions.find(a => a.artifact === "sessionJson")?.applied).toBe(true);
    expect(result.backups).toHaveLength(1);
    expect(fs.existsSync(result.backups[0])).toBe(true);

    const meta = JSON.parse(fs.readFileSync(path.join(repo, ".ai-session", "session.json"), "utf8"));
    expect(meta.schemaVersion).toBe(1);
    // now inspector reports ok and nothing left to migrate
    expect(new SchemaInspector(repo).inspect().checks.find(c => c.file === "session.json")?.status).toBe("ok");
  });

  it("normalizes a legacy git-baseline.json", () => {
    const repo = legacyRepo();
    const p = path.join(repo, ".ai-session", "git-baseline.json");
    const b = JSON.parse(fs.readFileSync(p, "utf8"));
    delete b.schemaVersion;
    fs.writeFileSync(p, JSON.stringify(b));
    const result = new SchemaMigrator(repo).migrate({ dryRun: false });
    expect(result.actions.some(a => a.artifact === "gitBaseline" && a.applied)).toBe(true);
    expect(JSON.parse(fs.readFileSync(p, "utf8")).schemaVersion).toBe(1);
  });

  it("normalizes legacy checkpoint lines", () => {
    const repo = legacyRepo();
    // write a checkpoint line without schemaVersion
    const cpPath = path.join(repo, ".ai-session", "checkpoints.jsonl");
    fs.writeFileSync(cpPath, JSON.stringify({ step: 1, result: "ok", changedFiles: [] }) + "\n");
    const result = new SchemaMigrator(repo).migrate({ dryRun: false });
    expect(result.actions.some(a => a.artifact === "checkpoints" && a.applied)).toBe(true);
    const line = JSON.parse(fs.readFileSync(cpPath, "utf8").trim());
    expect(line.schemaVersion).toBe(1);
  });

  it("normalizes legacy conversation.jsonl events", () => {
    const repo = legacyRepo();
    const p = path.join(repo, ".ai-session", "conversation.jsonl");
    fs.writeFileSync(p, JSON.stringify({ id: "evt_1", ts: "t", role: "user", kind: "message", text: "hi" }) + "\n");
    const result = new SchemaMigrator(repo).migrate({ dryRun: false });
    expect(result.actions.some(a => a.artifact === "conversation" && a.applied)).toBe(true);
    expect(JSON.parse(fs.readFileSync(p, "utf8").trim()).schemaVersion).toBe(1);
  });

  it("is idempotent — a current session has nothing to migrate", () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "rb-migrator-clean-"));
    new SessionManager(repo, defaultConfig).init("clean");
    new ExecutionCheckpoints(repo, defaultConfig).append({ step: 1, result: "ok" });
    const result = new SchemaMigrator(repo).migrate({ dryRun: false });
    expect(result.actions.filter(a => a.kind !== "skip")).toHaveLength(0);
    expect(result.backups).toHaveLength(0);
  });
});

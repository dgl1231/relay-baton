import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { SessionManager, defaultConfig } from "../index";
import { ExecutionCheckpoints } from "../plan/ExecutionCheckpoints";
import { SchemaInspector } from "../session/SchemaInspector";

function repoWithSession(): string {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "rb-schema-"));
  new SessionManager(repo, defaultConfig).init("schema test");
  return repo;
}
const checkFor = (repo: string, file: string) =>
  new SchemaInspector(repo).inspect().checks.find(c => c.file === file)!;

describe("SchemaInspector", () => {
  it("reports not-exists for a folder with no .ai-session", () => {
    const r = new SchemaInspector(fs.mkdtempSync(path.join(os.tmpdir(), "rb-schema-none-"))).inspect();
    expect(r.exists).toBe(false);
    expect(r.ok).toBe(true);
  });

  it("reports current session.json as ok", () => {
    const repo = repoWithSession();
    const c = checkFor(repo, "session.json");
    expect(c.status).toBe("ok");
    expect(c.foundVersion).toBe(1);
  });

  it("flags an outdated session.json schemaVersion", () => {
    const repo = repoWithSession();
    const p = path.join(repo, ".ai-session", "session.json");
    const meta = JSON.parse(fs.readFileSync(p, "utf8"));
    meta.schemaVersion = 0;
    fs.writeFileSync(p, JSON.stringify(meta));
    const c = checkFor(repo, "session.json");
    expect(c.status).toBe("outdated");
    expect(new SchemaInspector(repo).inspect().migratable).toBe(true);
  });

  it("treats a missing schemaVersion as legacy", () => {
    const repo = repoWithSession();
    const p = path.join(repo, ".ai-session", "session.json");
    const meta = JSON.parse(fs.readFileSync(p, "utf8"));
    delete meta.schemaVersion;
    fs.writeFileSync(p, JSON.stringify(meta));
    expect(checkFor(repo, "session.json").status).toBe("legacy");
  });

  it("reports a freshly-written git-baseline.json as ok (now schema-stamped)", () => {
    const repo = repoWithSession();
    expect(checkFor(repo, "git-baseline.json").status).toBe("ok");
  });

  it("flags a legacy git-baseline.json (no schemaVersion) and marks it migratable", () => {
    const repo = repoWithSession();
    const p = path.join(repo, ".ai-session", "git-baseline.json");
    const b = JSON.parse(fs.readFileSync(p, "utf8"));
    delete b.schemaVersion;
    fs.writeFileSync(p, JSON.stringify(b));
    expect(checkFor(repo, "git-baseline.json").status).toBe("legacy");
    expect(new SchemaInspector(repo).inspect().migratable).toBe(true);
  });

  it("flags a legacy conversation.jsonl event (no schemaVersion)", () => {
    const repo = repoWithSession();
    const p = path.join(repo, ".ai-session", "conversation.jsonl");
    fs.writeFileSync(p, JSON.stringify({ id: "evt_1", ts: "t", role: "user", kind: "message", text: "hi" }) + "\n");
    expect(checkFor(repo, "conversation.jsonl").status).toBe("legacy");
  });

  it("flags an ahead checkpoints schema as not ok", () => {
    const repo = repoWithSession();
    new ExecutionCheckpoints(repo, defaultConfig).append({ step: 1, result: "ok" });
    const p = path.join(repo, ".ai-session", "checkpoints.jsonl");
    const line = JSON.parse(fs.readFileSync(p, "utf8").trim());
    line.schemaVersion = 99;
    fs.writeFileSync(p, JSON.stringify(line) + "\n");
    const c = checkFor(repo, "checkpoints.jsonl");
    expect(c.status).toBe("ahead");
    expect(new SchemaInspector(repo).inspect().ok).toBe(false);
  });
});

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

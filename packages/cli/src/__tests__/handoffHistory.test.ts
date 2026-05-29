import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  collectHandoffHistory,
  firstNonEmptyLine,
  handoffHistoryCommand,
} from "../commands/handoffHistory";

function mkRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-history-"));
  fs.mkdirSync(path.join(dir, ".ai-session"), { recursive: true });
  return dir;
}

function touch(file: string, content: string, mtimeMs: number) {
  fs.writeFileSync(file, content, "utf8");
  fs.utimesSync(file, mtimeMs / 1000, mtimeMs / 1000);
}

describe("firstNonEmptyLine", () => {
  it("skips empty leading lines and strips leading # markers", () => {
    expect(firstNonEmptyLine("\n\n# Relay Baton Handoff\nbody\n")).toBe("Relay Baton Handoff");
  });
  it("clips long lines with an ellipsis", () => {
    const out = firstNonEmptyLine("x".repeat(200), 20);
    expect(out.length).toBe(20);
    expect(out.endsWith("…")).toBe(true);
  });
  it("returns sentinel when nothing readable is present", () => {
    expect(firstNonEmptyLine("")).toBe("(empty)");
    expect(firstNonEmptyLine("   \n\n")).toBe("(empty)");
  });
});

describe("collectHandoffHistory", () => {
  let dir: string;
  beforeEach(() => { dir = mkRepo(); });

  it("returns [] when .ai-session is missing", () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), "rb-empty-"));
    expect(collectHandoffHistory(empty)).toEqual([]);
  });

  it("lists current handoff.md plus timestamped backups, newest first, ignoring other files", () => {
    const sessionDir = path.join(dir, ".ai-session");

    // newest current
    touch(path.join(sessionDir, "handoff.md"), "# Relay Baton Handoff\ncurrent body\n", 3000);
    // older backup
    touch(path.join(sessionDir, "handoff.2026-05-27T05-58-13-213Z.md"), "# Relay Baton Handoff\nolder backup\n", 2000);
    // oldest backup
    touch(path.join(sessionDir, "handoff.2026-05-27T05-35-10-865Z.md"), "# Relay Baton Handoff\nfirst backup\n", 1000);

    // noise that should be ignored
    touch(path.join(sessionDir, "handoff.tmp.md"), "noise", 4000);
    touch(path.join(sessionDir, "not-a-handoff.md"), "noise", 5000);
    fs.mkdirSync(path.join(sessionDir, "handoff-dir"));

    const entries = collectHandoffHistory(dir);
    expect(entries.map(e => e.name)).toEqual([
      "handoff.md",
      "handoff.2026-05-27T05-58-13-213Z.md",
      "handoff.2026-05-27T05-35-10-865Z.md",
    ]);
    expect(entries[0].current).toBe(true);
    expect(entries[1].current).toBe(false);
    expect(entries[2].current).toBe(false);
    expect(entries[0].label).toBe("Relay Baton Handoff");
    expect(entries[0].size).toBeGreaterThan(0);
  });
});

describe("handoffHistoryCommand", () => {
  let dir: string;
  let logs: string[];
  let savedCwd: string;

  beforeEach(() => {
    dir = mkRepo();
    logs = [];
    vi.spyOn(console, "log").mockImplementation((...args: any[]) => {
      logs.push(args.map(a => String(a)).join(" "));
    });
    savedCwd = process.cwd();
    process.chdir(dir);
  });

  afterEach(() => {
    process.chdir(savedCwd);
    vi.restoreAllMocks();
  });

  it("prints the empty-history sentinel when no handoff files exist", async () => {
    // Resolve by explicit path so a registered active project never shadows
    // the temp repo this test owns.
    await handoffHistoryCommand({ path: dir });
    expect(logs.join("\n")).toMatch(/no handoff history/i);
  });

  it("prints a header row and one row per handoff document without dumping content bodies", async () => {
    const sessionDir = path.join(dir, ".ai-session");
    touch(path.join(sessionDir, "handoff.md"), "# Relay Baton Handoff\nSENSITIVE BODY MARKER xyz\n", 2000);
    touch(path.join(sessionDir, "handoff.2026-05-27T05-35-10-865Z.md"), "# Relay Baton Handoff\nOLDER BODY MARKER abc\n", 1000);

    await handoffHistoryCommand({ path: dir });
    const out = logs.join("\n");

    // header is printed
    expect(out).toMatch(/TIMESTAMP\s+SIZE\s+FILE\s+LABEL/);
    // both file names show up
    expect(out).toContain("handoff.md");
    expect(out).toContain("handoff.2026-05-27T05-35-10-865Z.md");
    // labels are derived from first non-empty content line
    expect(out).toContain("Relay Baton Handoff");
    // body bytes are NOT inlined — only filename + label
    expect(out).not.toContain("SENSITIVE BODY MARKER");
    expect(out).not.toContain("OLDER BODY MARKER");
    // the current row is marked with a leading *
    expect(out.split("\n").some(l => /^\*\s+\S+\s+\S+\s+handoff\.md/.test(l))).toBe(true);
  });
});

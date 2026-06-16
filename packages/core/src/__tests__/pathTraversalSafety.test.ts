import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { MAX_INSPECT_FILE_BYTES, resolveWithin } from "@relay-baton/shared";
import { SessionManager, defaultConfig } from "../index";
import { SessionArchiver } from "../session/SessionArchiver";
import { SessionArchiveStore } from "../session/SessionArchiveStore";
import { HandoffBundler } from "../handoff/HandoffBundler";
import { HandoffBundleInspector } from "../handoff/HandoffBundleInspector";

describe("resolveWithin (v2.2 path-traversal guard)", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rb-rw-"));

  it("accepts a plain in-root relative target", () => {
    const r = resolveWithin(root, "handoff.md");
    expect(r.abs).toBe(path.join(root, "handoff.md"));
    expect(r.reason).toBeUndefined();
  });

  it("rejects an absolute POSIX target", () => {
    const r = resolveWithin(root, "/etc/passwd");
    expect(r.abs).toBeNull();
    expect(r.reason).toBe("absolute");
  });

  it("rejects a Windows drive / UNC target", () => {
    expect(resolveWithin(root, "C:\\Windows\\win.ini").reason).toBe("absolute");
    expect(resolveWithin(root, "\\\\server\\share\\x").reason).toBe("absolute");
  });

  it("rejects `..` escapes", () => {
    expect(resolveWithin(root, "../../etc/passwd").reason).toBe("escapes-root");
    expect(resolveWithin(root, "a/../../b").reason).toBe("escapes-root");
  });
});

describe("HandoffBundleInspector untrusted manifest", () => {
  function bundle(): { out: string; dir: string } {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "rb-pt-repo-"));
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "rb-pt-out-"));
    new SessionManager(repo, defaultConfig).init("traversal test");
    fs.writeFileSync(path.join(repo, ".ai-session", "handoff.md"), "# Handoff\n\nwip\n");
    const r = new HandoffBundler(repo).bundle({ bundleRoot: out });
    return { out, dir: r.bundleDir! };
  }

  it("writes relative (not absolute) manifest targets", () => {
    const { dir } = bundle();
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
    for (const f of manifest.files) {
      expect(path.isAbsolute(f.target)).toBe(false);
      expect(f.target).not.toContain("..");
    }
  });

  it("flags a tampered manifest with a `..` target as unsafe and does not read outside", () => {
    const { out, dir } = bundle();
    const secret = fs.mkdtempSync(path.join(os.tmpdir(), "rb-pt-secret-"));
    fs.writeFileSync(path.join(secret, "secret.txt"), "TOP SECRET");
    const mp = path.join(dir, "manifest.json");
    const manifest = JSON.parse(fs.readFileSync(mp, "utf8"));
    manifest.files.push({ source: "x", target: path.relative(dir, path.join(secret, "secret.txt")), size: 10, sha256: "0".repeat(64) });
    fs.writeFileSync(mp, JSON.stringify(manifest));

    const result = new HandoffBundleInspector({ bundleRoot: out }).inspect(path.basename(dir));
    expect(result.unsafe.length).toBe(1);
    expect(result.safe).toBe(false);
    const bad = result.files.find(f => !f.safe)!;
    expect(bad.unsafeReason).toBe("escapes-root");
    expect(bad.hashMatches).toBe(false); // never read/verified
  });

  it("rejects an absolute target", () => {
    const { out, dir } = bundle();
    const mp = path.join(dir, "manifest.json");
    const manifest = JSON.parse(fs.readFileSync(mp, "utf8"));
    manifest.files.push({ source: "x", target: process.platform === "win32" ? "C:\\Windows\\win.ini" : "/etc/passwd", size: 10, sha256: "0".repeat(64) });
    fs.writeFileSync(mp, JSON.stringify(manifest));

    const result = new HandoffBundleInspector({ bundleRoot: out }).inspect(path.basename(dir));
    expect(result.files.find(f => !f.safe)?.unsafeReason).toBe("absolute");
    expect(result.safe).toBe(false);
  });

  it("flags an oversized manifest entry as unsafe", () => {
    const { out, dir } = bundle();
    const mp = path.join(dir, "manifest.json");
    const manifest = JSON.parse(fs.readFileSync(mp, "utf8"));
    manifest.files.push({ source: "x", target: "huge.bin", size: MAX_INSPECT_FILE_BYTES + 1, sha256: "0".repeat(64) });
    fs.writeFileSync(mp, JSON.stringify(manifest));

    const result = new HandoffBundleInspector({ bundleRoot: out }).inspect(path.basename(dir));
    expect(result.files.find(f => !f.safe)?.unsafeReason).toBe("too-large");
  });

  it("a clean bundle stays safe + intact", () => {
    const { out, dir } = bundle();
    const result = new HandoffBundleInspector({ bundleRoot: out }).inspect(path.basename(dir));
    expect(result.intact).toBe(true);
    expect(result.safe).toBe(true);
    expect(result.unsafe).toHaveLength(0);
  });
});

describe("SessionArchiveStore untrusted manifest", () => {
  function archive(): { archiveRoot: string; dir: string; id: string } {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "rb-pt-arepo-"));
    const archiveRoot = fs.mkdtempSync(path.join(os.tmpdir(), "rb-pt-aroot-"));
    new SessionManager(repo, defaultConfig).init("traversal test");
    const r = new SessionArchiver(repo).archive({ archiveRoot });
    return { archiveRoot, dir: r.archiveDir!, id: path.basename(r.archiveDir!) };
  }

  it("flags a `..` target as unsafe", () => {
    const { archiveRoot, dir, id } = archive();
    const mp = path.join(dir, "manifest.json");
    const manifest = JSON.parse(fs.readFileSync(mp, "utf8"));
    manifest.files.push({ source: "x", target: "../../escape.txt", size: 5, sha256: "0".repeat(64) });
    fs.writeFileSync(mp, JSON.stringify(manifest));

    const result = new SessionArchiveStore({ archiveRoot }).inspect(id);
    expect(result.unsafe.length).toBe(1);
    expect(result.safe).toBe(false);
  });

  it("a clean archive stays safe + intact with relative targets", () => {
    const { archiveRoot, dir, id } = archive();
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
    for (const f of manifest.files) expect(path.isAbsolute(f.target)).toBe(false);
    const result = new SessionArchiveStore({ archiveRoot }).inspect(id);
    expect(result.intact).toBe(true);
    expect(result.safe).toBe(true);
  });
});

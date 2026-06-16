import * as fs from "fs";
import * as path from "path";
import { IGNORE_DIRS } from "@relay-baton/shared";
import { outlineFile } from "../token-diet/SymbolOutline";

const KEY_FILE_PATTERNS = [
  /^package\.json$/,
  /\.csproj$/,
  /\.sln$/,
  /^vite\.config\./,
  /^tsconfig.*\.json$/,
  /^appsettings.*\.json$/,
  /^Dockerfile$/,
  /^docker-compose\./,
  /^helm\/Chart\.yaml$/,
  /^AGENTS\.md$/,
  /^CLAUDE\.md$/,
  /^pnpm-workspace\.yaml$/,
];

export class RepoMapGenerator {
  constructor(private repoRoot: string) {}

  generate(maxChars: number, changed: string[] = []): string {
    const tree = this.walk(this.repoRoot, "", 0, 3);
    const keyFiles = this.findKeyFiles();

    const parts: string[] = [];
    parts.push("# Repo Map");
    parts.push("");
    parts.push("Root: " + this.repoRoot);
    parts.push("");
    parts.push("## Directory Tree (depth<=3, ignoring vendor/build dirs)");
    parts.push("");
    parts.push("```");
    parts.push(tree.join("\n"));
    parts.push("```");
    parts.push("");
    parts.push("## Key Files");
    parts.push("");
    if (keyFiles.length === 0) parts.push("(none detected)");
    else for (const f of keyFiles) parts.push("- " + f);
    parts.push("");
    if (changed.length > 0) {
      parts.push("## Changed Files");
      parts.push("");
      for (const f of changed) parts.push("- " + f);
      parts.push("");
    }

    // v2.4 — symbol/heading outline for the files that matter (changed first,
    // then key files), so the next agent sees structure, not just a tree.
    const outline = this.symbolSection(changed, keyFiles);
    if (outline.length > 0) {
      parts.push("## Symbols (changed + key files)");
      parts.push("");
      parts.push(...outline);
      parts.push("");
    }

    let out = parts.join("\n");
    if (out.length > maxChars) {
      out = out.slice(0, Math.max(0, maxChars - 80)) + "\n... [repo-map truncated]\n";
    }
    return out;
  }

  /**
   * Build a bounded "file → symbols" outline. Changed files rank first (most
   * relevant to the handoff), then key files, de-duplicated. Caps the number of
   * files so a huge changeset can't blow the repo-map budget on its own.
   */
  private symbolSection(changed: string[], keyFiles: string[], maxFiles = 20): string[] {
    const ordered: string[] = [];
    const seen = new Set<string>();
    for (const f of [...changed, ...keyFiles]) {
      const norm = f.replace(/\\/g, "/");
      if (seen.has(norm)) continue;
      seen.add(norm);
      ordered.push(norm);
      if (ordered.length >= maxFiles) break;
    }

    const lines: string[] = [];
    for (const f of ordered) {
      const o = outlineFile(this.repoRoot, f);
      if (!o) continue;
      lines.push(`- ${f}`);
      for (const s of o.symbols) lines.push(`  - ${s}`);
    }
    return lines;
  }

  private walk(dir: string, rel: string, depth: number, maxDepth: number): string[] {
    if (depth > maxDepth) return [];
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return [];
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    const lines: string[] = [];
    for (const e of entries) {
      if (e.name.startsWith(".") && e.name !== ".claude") {
        if (IGNORE_DIRS.has(e.name)) continue;
      }
      if (e.isDirectory() && IGNORE_DIRS.has(e.name)) continue;
      const indent = "  ".repeat(depth);
      if (e.isDirectory()) {
        lines.push(`${indent}${e.name}/`);
        lines.push(...this.walk(path.join(dir, e.name), path.join(rel, e.name), depth + 1, maxDepth));
      } else {
        lines.push(`${indent}${e.name}`);
      }
    }
    return lines;
  }

  private findKeyFiles(): string[] {
    const found: string[] = [];
    const scan = (dir: string, rel: string, depth: number) => {
      if (depth > 4) return;
      let entries: fs.Dirent[] = [];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        if (e.isDirectory() && IGNORE_DIRS.has(e.name)) continue;
        const relPath = rel ? `${rel}/${e.name}` : e.name;
        if (e.isFile()) {
          for (const pat of KEY_FILE_PATTERNS) {
            if (pat.test(e.name) || pat.test(relPath)) {
              found.push(relPath);
              break;
            }
          }
        } else if (e.isDirectory()) {
          scan(path.join(dir, e.name), relPath, depth + 1);
        }
      }
    };
    scan(this.repoRoot, "", 0);
    return [...new Set(found)].sort();
  }
}

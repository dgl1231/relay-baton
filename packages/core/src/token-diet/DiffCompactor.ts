import { SKIP_DIFF_PATTERNS } from "@relay-baton/shared";

export interface DiffFileChunk {
  file: string;
  body: string;
  skipped: boolean;
  reason?: string;
}

export class DiffCompactor {
  splitByFile(rawDiff: string): DiffFileChunk[] {
    if (!rawDiff.trim()) return [];
    const chunks: DiffFileChunk[] = [];
    const parts = rawDiff.split(/^diff --git /m);
    for (const part of parts) {
      if (!part.trim()) continue;
      const body = "diff --git " + part;
      const m = /a\/(\S+) b\/(\S+)/.exec(part);
      const file = m ? m[2] : "(unknown)";
      const skip = this.shouldSkip(file);
      const isBinary = /Binary files .* differ/.test(part);
      chunks.push({
        file,
        body,
        skipped: skip || isBinary,
        reason: isBinary ? "binary" : skip ? "lock/build/min" : undefined,
      });
    }
    return chunks;
  }

  /**
   * v2.4 — relevance-ranked diff selection. Score each non-skipped chunk by
   * proximity to the task (path mentioned in the task, sharing a directory with
   * a mentioned path), source-vs-test-vs-doc weight, and shallow path depth, so
   * the most relevant file diffs survive the budget first. Deterministic:
   * ties break alphabetically. No embeddings.
   */
  compactRanked(rawDiff: string, maxChars: number, opts: { task?: string; maxPerFile?: number } = {}): string {
    const chunks = this.splitByFile(rawDiff);
    if (chunks.length === 0) return "(no diff)";
    const maxPerFile = opts.maxPerFile ?? 1200;

    const mentioned = this.mentionedPaths(opts.task ?? "");
    const mentionedDirs = new Set([...mentioned].map(p => p.split("/").slice(0, -1).join("/")));

    const score = (file: string): number => {
      const f = file.replace(/\\/g, "/");
      let s = 0;
      if (mentioned.has(f)) s += 100;
      const dir = f.split("/").slice(0, -1).join("/");
      if (dir && mentionedDirs.has(dir)) s += 50;
      s += this.kindWeight(f);
      s -= Math.min(20, f.split("/").length * 2); // prefer shallower paths
      return s;
    };

    // Stable sort: relevance desc, then alphabetical. Skipped chunks (lock/build/
    // binary) always sink to the bottom — they carry the least signal.
    const ranked = chunks
      .map((c, i) => ({ c, i }))
      .sort((a, b) => {
        if (a.c.skipped !== b.c.skipped) return a.c.skipped ? 1 : -1;
        const sd = score(b.c.file) - score(a.c.file);
        if (sd !== 0) return sd;
        return a.c.file.localeCompare(b.c.file);
      })
      .map(x => x.c);

    return this.emit(ranked, maxChars, maxPerFile);
  }

  compact(rawDiff: string, maxChars: number, maxPerFile = 1200): string {
    const chunks = this.splitByFile(rawDiff);
    if (chunks.length === 0) return "(no diff)";
    return this.emit(chunks, maxChars, maxPerFile);
  }

  private emit(chunks: DiffFileChunk[], maxChars: number, maxPerFile: number): string {
    const out: string[] = [];
    let used = 0;
    for (const c of chunks) {
      if (c.skipped) {
        const note = `# ${c.file} — diff omitted (${c.reason})\n`;
        if (used + note.length > maxChars) break;
        out.push(note);
        used += note.length;
        continue;
      }
      const head = c.body.length > maxPerFile ? c.body.slice(0, maxPerFile) + "\n... [file diff truncated]\n" : c.body;
      if (used + head.length > maxChars) {
        out.push(`# ${c.file} — diff truncated (budget reached)\n`);
        break;
      }
      out.push(head);
      used += head.length;
    }
    return out.join("\n");
  }

  shouldSkip(file: string): boolean {
    return SKIP_DIFF_PATTERNS.some(p => p.test(file));
  }

  /** Source > test > docs/config, by extension/name. Deterministic weights. */
  private kindWeight(file: string): number {
    if (/(^|\/)[^/]*\.(test|spec)\.[a-z]+$/i.test(file) || /(^|\/)(tests?|__tests__)\//i.test(file)) return 5;
    if (/\.(ts|tsx|js|jsx|mjs|cjs|py|cs|go|rs|java)$/i.test(file)) return 20;
    if (/\.(md|markdown|json|ya?ml|toml)$/i.test(file)) return 1;
    return 8;
  }

  /** File-like tokens referenced in the task that look like real paths. */
  private mentionedPaths(task: string): Set<string> {
    const out = new Set<string>();
    const re = /[\w./\\-]+\.[A-Za-z0-9]{1,8}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(task)) !== null) out.add(m[0].replace(/\\/g, "/"));
    return out;
  }
}

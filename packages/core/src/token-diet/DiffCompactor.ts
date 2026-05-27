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

  compact(rawDiff: string, maxChars: number, maxPerFile = 1200): string {
    const chunks = this.splitByFile(rawDiff);
    if (chunks.length === 0) return "(no diff)";
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
}

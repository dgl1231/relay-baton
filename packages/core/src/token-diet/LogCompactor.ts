export interface LogTailResult {
  tail: string;
  knownErrors: string[];
  exitCodes: number[];
}

export class LogCompactor {
  compact(rawLog: string, maxChars: number, fallbackPatterns: string[] = []): LogTailResult {
    const lines = rawLog.split(/\r?\n/);
    const errors = new Set<string>();
    const exitCodes: number[] = [];
    const lowers = fallbackPatterns.map(p => p.toLowerCase());

    for (let i = 0; i < lines.length; i++) {
      const low = lines[i].toLowerCase();
      if (low.includes("command not found") || low.includes("build failed") || low.includes("test failed")) {
        errors.add(lines[i].trim());
      }
      for (const p of lowers) {
        if (low.includes(p)) {
          const ctx = lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 2)).join(" | ");
          errors.add(`pattern "${p}": ${ctx.slice(0, 240)}`);
        }
      }
      const m = /--- exit (-?\d+) ---/.exec(lines[i]);
      if (m) exitCodes.push(Number(m[1]));
    }

    const tailRaw = rawLog;
    const tail = tailRaw.length <= maxChars ? tailRaw : tailRaw.slice(tailRaw.length - maxChars);

    return { tail, knownErrors: [...errors], exitCodes };
  }

  /**
   * Produce an in-place compressed form of a long log for context-compression
   * mode: keep the last `tailLines`, plus a window around fallback-pattern hits
   * and exit-code lines; collapse everything else into "[N lines elided]"
   * markers. Deterministic, no LLM. Always preserves the last fallback hit so
   * fallback detection is never disarmed.
   */
  compressLog(
    rawLog: string,
    opts: { tailLines?: number; contextLines?: number; fallbackPatterns?: string[] } = {},
  ): string {
    const tailLines = opts.tailLines ?? 200;
    const ctx = opts.contextLines ?? 2;
    const lowers = (opts.fallbackPatterns ?? []).map(p => p.toLowerCase());
    const lines = rawLog.split(/\r?\n/);
    const n = lines.length;
    if (n <= tailLines) return rawLog;

    const keep = new Array<boolean>(n).fill(false);
    // Always keep the tail.
    for (let i = Math.max(0, n - tailLines); i < n; i++) keep[i] = true;
    // Keep windows around interesting lines.
    for (let i = 0; i < n; i++) {
      const low = lines[i].toLowerCase();
      const interesting =
        /--- exit (-?\d+) ---/.test(lines[i]) ||
        low.includes("command not found") ||
        low.includes("build failed") ||
        low.includes("test failed") ||
        lowers.some(p => low.includes(p));
      if (interesting) {
        for (let j = Math.max(0, i - ctx); j <= Math.min(n - 1, i + ctx); j++) keep[j] = true;
      }
    }

    const out: string[] = [];
    let elided = 0;
    for (let i = 0; i < n; i++) {
      if (keep[i]) {
        if (elided > 0) {
          out.push(`[... ${elided} lines elided by relay-baton context compression ...]`);
          elided = 0;
        }
        out.push(lines[i]);
      } else {
        elided++;
      }
    }
    if (elided > 0) out.push(`[... ${elided} lines elided by relay-baton context compression ...]`);
    return out.join("\n");
  }
}

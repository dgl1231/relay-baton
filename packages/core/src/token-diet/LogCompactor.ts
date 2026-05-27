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
}

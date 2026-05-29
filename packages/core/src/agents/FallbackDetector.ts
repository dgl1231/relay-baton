export interface FallbackHit {
  pattern: string;
  line: string;
  index: number;
}

// Lines that look like ripgrep / grep / file:line search results.
// e.g. "README.md:10:- ...", "packages/core/foo.ts:99:..."
const GREP_RESULT_LINE = /^[^\s:]+\.[A-Za-z0-9]{1,8}:\d+[:\-]/;

// Lines that look like documentation about fallback patterns themselves.
const DOC_EXPLAIN_HINTS = [
  /fallback\s+pattern/i,
  /(usage|rate|token|context|quota)\s*[\/,]\s*(usage|rate|token|context|quota)/i, // mentions multiple keywords together
  /(quota|limit|usage|context)\s+패턴/, // Korean: "quota 패턴" etc.
  /감지한다/, // Korean: "...detect"
  /detection pattern/i,
];

/**
 * Overlay a project's fallback-pattern overrides onto the global list.
 * Project patterns are appended after the globals and de-duplicated
 * case-insensitively (first occurrence wins, original casing preserved).
 */
export function resolveFallbackPatterns(global: string[], projectPatterns?: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of [...global, ...(projectPatterns ?? [])]) {
    const key = p.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

export class FallbackDetector {
  private patterns: string[];
  private seen = new Set<string>();
  private counter = 0;

  constructor(patterns: string[]) {
    this.patterns = patterns.map(p => p.toLowerCase());
  }

  feed(line: string): FallbackHit | null {
    const idx = ++this.counter;

    // Skip lines that are clearly grep results or doc explanations.
    if (GREP_RESULT_LINE.test(line)) return null;
    for (const re of DOC_EXPLAIN_HINTS) {
      if (re.test(line)) return null;
    }

    const low = line.toLowerCase();
    for (const p of this.patterns) {
      if (low.includes(p)) {
        if (this.seen.has(p)) return null;
        this.seen.add(p);
        return { pattern: p, line, index: idx };
      }
    }
    return null;
  }

  reset() {
    this.seen.clear();
    this.counter = 0;
  }
}

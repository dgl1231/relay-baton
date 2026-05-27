export interface FallbackHit {
  pattern: string;
  line: string;
  index: number;
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

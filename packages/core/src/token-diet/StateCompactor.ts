const SECTIONS = [
  "Goal", "Done", "In Progress", "Remaining", "Decisions", "Risks", "Next Step",
];

export class StateCompactor {
  compact(stateMd: string, maxChars: number): string {
    const buckets: Record<string, string[]> = {};
    for (const s of SECTIONS) buckets[s] = [];
    let current: string | null = null;
    const lines = stateMd.split(/\r?\n/);
    for (const line of lines) {
      const m = /^##\s+(.+)\s*$/.exec(line);
      if (m && SECTIONS.includes(m[1].trim())) {
        current = m[1].trim();
        continue;
      }
      if (current) buckets[current].push(line);
    }
    const parts: string[] = ["# Compact State", ""];
    for (const s of SECTIONS) {
      parts.push(`## ${s}`);
      const dedup = [...new Set(buckets[s].map(l => l.replace(/\s+$/g, "")))]
        .filter(l => l.trim().length > 0);
      const trimmed = dedup.slice(0, 12);
      if (trimmed.length === 0) parts.push("");
      else parts.push(...trimmed, "");
    }
    let out = parts.join("\n");
    if (out.length > maxChars) {
      out = out.slice(0, Math.max(0, maxChars - 40)) + "\n... [compact-state truncated]\n";
    }
    return out;
  }
}

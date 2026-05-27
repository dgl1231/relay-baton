import { TRUNCATE_MARKER } from "@relay-baton/shared";

const SECTION_PRIORITY: Record<string, "high" | "medium" | "low"> = {
  "Goal": "high",
  "Previous Agent": "high",
  "Next Agent": "high",
  "Fallback Reason": "high",
  "Token Diet Summary": "high",
  "Changed Files": "high",
  "Known Errors": "high",
  "Next Steps": "high",
  "Instructions for Next Agent": "high",
  "Repo Map": "medium",
  "Progress Summary": "medium",
  "Test Results": "medium",
  "Relevant Files": "medium",
  "Current Repository State": "medium",
  "Important Diff": "low",
  "Full Diff": "low",
  "Long Logs": "low",
  "Full Git Status": "low",
};

export interface CompactedHandoff {
  text: string;
  truncated: boolean;
}

export class HandoffCompactor {
  compact(handoffMd: string, maxChars: number): CompactedHandoff {
    let truncated = false;
    let text = this.dedupeBlankLines(handoffMd);
    if (text.length <= maxChars) return { text, truncated: false };

    const sections = this.splitSections(text);
    for (const prio of ["low", "medium", "high"] as const) {
      for (const s of sections) {
        const p = SECTION_PRIORITY[s.title] ?? "medium";
        if (p !== prio) continue;
        if (this.totalLen(sections) <= maxChars) break;
        const target = Math.max(120, Math.floor(s.body.length * 0.5));
        if (s.body.length > target) {
          s.body = s.body.slice(0, target) + "\n\n" + TRUNCATE_MARKER + "\n";
          truncated = true;
        }
      }
      if (this.totalLen(sections) <= maxChars) break;
    }

    text = sections.map(s => `## ${s.title}\n${s.body}`).join("\n");
    const header = sections[0]?.preHeader ?? "# Relay Baton Handoff\n";
    text = header + text;
    if (text.length > maxChars) {
      text = text.slice(0, Math.max(0, maxChars - TRUNCATE_MARKER.length - 4)) + "\n" + TRUNCATE_MARKER + "\n";
      truncated = true;
    }
    return { text, truncated };
  }

  private dedupeBlankLines(s: string): string {
    return s.replace(/\n{3,}/g, "\n\n");
  }

  private splitSections(md: string): Array<{ title: string; body: string; preHeader?: string }> {
    const lines = md.split(/\r?\n/);
    const result: Array<{ title: string; body: string; preHeader?: string }> = [];
    let preHeader: string[] = [];
    let cur: { title: string; body: string[] } | null = null;
    for (const line of lines) {
      const m = /^##\s+(.+)\s*$/.exec(line);
      if (m) {
        if (cur) result.push({ title: cur.title, body: cur.body.join("\n") });
        cur = { title: m[1].trim(), body: [] };
      } else {
        if (cur) cur.body.push(line);
        else preHeader.push(line);
      }
    }
    if (cur) result.push({ title: cur.title, body: cur.body.join("\n") });
    if (result.length > 0) result[0].preHeader = preHeader.join("\n") + "\n";
    return result;
  }

  private totalLen(sections: Array<{ title: string; body: string }>): number {
    return sections.reduce((n, s) => n + s.title.length + s.body.length + 4, 0);
  }
}

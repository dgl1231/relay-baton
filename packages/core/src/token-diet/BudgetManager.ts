import type { DietProfile } from "@relay-baton/shared";
import { TRUNCATE_MARKER } from "@relay-baton/shared";

export class BudgetManager {
  private used: Record<string, number> = {};
  private truncated = false;

  constructor(public profile: DietProfile) {}

  fit(section: keyof DietProfile, content: string): string {
    const max = this.profile[section] as number;
    this.used[section] = (this.used[section] ?? 0) + Math.min(content.length, max);
    if (content.length <= max) return content;
    this.truncated = true;
    const keep = Math.max(0, max - TRUNCATE_MARKER.length - 4);
    return content.slice(0, keep) + "\n\n" + TRUNCATE_MARKER + "\n";
  }

  fitTail(section: keyof DietProfile, content: string): string {
    const max = this.profile[section] as number;
    this.used[section] = (this.used[section] ?? 0) + Math.min(content.length, max);
    if (content.length <= max) return content;
    this.truncated = true;
    const keep = Math.max(0, max - TRUNCATE_MARKER.length - 4);
    return TRUNCATE_MARKER + "\n...\n" + content.slice(content.length - keep);
  }

  isTruncated(): boolean { return this.truncated; }
  usage(): Record<string, number> { return { ...this.used }; }
}

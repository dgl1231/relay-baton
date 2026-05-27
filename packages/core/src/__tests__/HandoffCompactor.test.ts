import { describe, it, expect } from "vitest";
import { HandoffCompactor } from "../token-diet/HandoffCompactor";

describe("HandoffCompactor", () => {
  it("keeps within maxHandoffChars", () => {
    const md = `# Relay Baton Handoff\n## Goal\n` + "g".repeat(500) +
      "\n## Full Diff\n" + "d".repeat(20000) +
      "\n## Next Steps\n- a\n";
    const r = new HandoffCompactor().compact(md, 1500);
    expect(r.text.length).toBeLessThanOrEqual(1500);
    expect(r.truncated).toBe(true);
  });
  it("passes through small content", () => {
    const md = `# Relay Baton Handoff\n## Goal\nshort\n`;
    const r = new HandoffCompactor().compact(md, 5000);
    expect(r.truncated).toBe(false);
  });
});

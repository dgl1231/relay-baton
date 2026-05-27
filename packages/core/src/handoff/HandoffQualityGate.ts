import * as fs from "fs";
import { SessionFiles } from "../session/SessionFiles";

export interface GateResult {
  ok: boolean;
  failures: string[];
}

export class HandoffQualityGate {
  constructor(private repoRoot: string) {}

  check(): GateResult {
    const f = new SessionFiles(this.repoRoot);
    const failures: string[] = [];
    const exists = (key: Parameters<SessionFiles["p"]>[0], label: string, mustNotBeEmpty = true) => {
      const p = f.p(key);
      if (!fs.existsSync(p)) { failures.push(`${label}: missing ${p}`); return ""; }
      const content = fs.readFileSync(p, "utf8");
      if (mustNotBeEmpty && content.trim().length === 0) failures.push(`${label}: empty ${p}`);
      return content;
    };
    exists("task", "task.md");
    const handoff = exists("handoff", "handoff.md");
    exists("changedFiles", "changed-files.md", false);
    exists("repoMap", "repo-map.md", false);
    exists("sessionJson", "session.json");

    const required = ["## Goal", "## Previous Agent", "## Next Agent", "## Changed Files", "## Known Errors", "## Next Steps"];
    for (const r of required) {
      if (handoff && !handoff.includes(r)) failures.push(`handoff.md missing section ${r}`);
    }
    return { ok: failures.length === 0, failures };
  }
}

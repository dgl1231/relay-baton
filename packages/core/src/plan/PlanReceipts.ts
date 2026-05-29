import * as fs from "fs";
import { SessionFiles } from "../session/SessionFiles";

export type ReceiptStatus = "done" | "skipped";

export interface Receipt {
  status: ReceiptStatus;
  /** 1-based step index this receipt refers to. */
  step: number;
  note: string;
  ts: string;
}

const RECEIPTS_HEADING = "## Execution receipts";

/**
 * Append-only execution receipts for plan steps. Receipts are never rewritten;
 * a correction is a new receipt. They live under a `## Execution receipts`
 * heading at the end of plan.md so the diff/review tooling can read them
 * deterministically without a model call.
 */
export class PlanReceipts {
  private files: SessionFiles;
  constructor(repoRoot: string) {
    this.files = new SessionFiles(repoRoot);
  }

  private read(): string {
    try { return fs.readFileSync(this.files.p("plan"), "utf8"); } catch { return ""; }
  }

  /** Append a `[done]` / `[skipped]` receipt line for a step. Best-effort. */
  append(step: number, status: ReceiptStatus, note = ""): Receipt {
    const receipt: Receipt = {
      status,
      step,
      note: note.trim(),
      ts: new Date().toISOString(),
    };
    const planPath = this.files.p("plan");
    let body = this.read();
    if (!body.trim()) return receipt; // no plan to annotate
    if (!body.includes(RECEIPTS_HEADING)) {
      body = body.replace(/\s*$/, "") + `\n\n${RECEIPTS_HEADING}\n`;
    }
    const noteSuffix = receipt.note ? ` — ${receipt.note}` : "";
    const line = `- [${status}] step ${step}${noteSuffix} (${receipt.ts})\n`;
    try { fs.writeFileSync(planPath, body.replace(/\s*$/, "") + "\n" + line, "utf8"); } catch { /* best-effort */ }
    return receipt;
  }

  /** Parse all receipts recorded in plan.md. */
  list(): Receipt[] {
    const body = this.read();
    const out: Receipt[] = [];
    const re = /^- \[(done|skipped)\] step (\d+)(?: — (.*?))? \(([^)]+)\)\s*$/;
    let inSection = false;
    for (const raw of body.split(/\r?\n/)) {
      const line = raw.trim();
      if (line.startsWith("## ")) { inSection = line === RECEIPTS_HEADING; continue; }
      if (!inSection) continue;
      const m = re.exec(line);
      if (m) out.push({ status: m[1] as ReceiptStatus, step: Number(m[2]), note: m[3] ?? "", ts: m[4] });
    }
    return out;
  }
}

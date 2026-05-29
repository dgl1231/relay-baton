import { SessionManager, ConfigLoader, PlanReceipts, ConversationLog } from "@relay-baton/core";
import type { ReceiptStatus } from "@relay-baton/core";
import { ProjectOpts, resolveRepoRoot } from "./projectOptions";

export interface ReceiptOpts extends ProjectOpts {
  note?: string;
  json?: boolean;
}

async function record(status: ReceiptStatus, step: string, opts: ReceiptOpts) {
  const n = Number(step);
  if (!Number.isInteger(n) || n < 1) {
    console.error(`[relay-baton] step must be a positive integer, got: ${step}`);
    process.exit(2);
  }
  const repoRoot = resolveRepoRoot(opts);
  const { config } = ConfigLoader.load(repoRoot);
  const meta = new SessionManager(repoRoot, config).getMeta();

  const receipt = new PlanReceipts(repoRoot).append(n, status, opts.note ?? "");
  new ConversationLog(repoRoot).append({
    role: "relay-baton",
    kind: "execute",
    text: `receipt: step ${n} ${status}${receipt.note ? " — " + receipt.note : ""}`,
    sessionId: meta?.id,
    refs: { plan: "plan.md" },
    meta: { stepRefs: [`step-${n}`], confirmed: true },
  });

  console.log(`[relay-baton] recorded [${status}] for step ${n}.`);
}

export async function receiptDoneCommand(step: string, opts: ReceiptOpts = {}) {
  return record("done", step, opts);
}

export async function receiptSkipCommand(step: string, opts: ReceiptOpts = {}) {
  return record("skipped", step, opts);
}

export async function receiptListCommand(opts: ReceiptOpts = {}) {
  const repoRoot = resolveRepoRoot(opts);
  const receipts = new PlanReceipts(repoRoot).list();
  if (opts.json) {
    console.log(JSON.stringify(receipts, null, 2));
    return;
  }
  if (receipts.length === 0) {
    console.log("[relay-baton] no execution receipts recorded.");
    return;
  }
  for (const r of receipts) {
    console.log(`[${r.status}] step ${r.step}${r.note ? " — " + r.note : ""} (${r.ts})`);
  }
}

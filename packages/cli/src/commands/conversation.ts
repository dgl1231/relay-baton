import * as fs from "fs";
import { ConfigLoader, ConversationLog, SessionManager } from "@relay-baton/core";
import type { ConversationEventKind, ConversationRole } from "@relay-baton/shared";
import { ProjectOpts, resolveRepoRoot } from "./projectOptions";

const ROLES: ConversationRole[] = ["user", "relay-baton", "codex", "claude"];
const KINDS: ConversationEventKind[] = [
  "message",
  "command",
  "prompt_preview",
  "agent_run",
  "plan",
  "execute",
  "review",
  "diagnose",
  "handoff",
  "status",
  "budget",
];

export interface ConversationAppendOpts extends ProjectOpts {
  json?: boolean;
  role?: ConversationRole;
  kind?: ConversationEventKind;
}

function parseRole(value: string | undefined): ConversationRole {
  const role = (value ?? "user") as ConversationRole;
  if (!ROLES.includes(role)) {
    console.error(`[relay-baton] invalid conversation role: ${value}`);
    process.exit(2);
  }
  return role;
}

function parseKind(value: string | undefined): ConversationEventKind {
  const kind = (value ?? "message") as ConversationEventKind;
  if (!KINDS.includes(kind)) {
    console.error(`[relay-baton] invalid conversation kind: ${value}`);
    process.exit(2);
  }
  return kind;
}

export async function conversationAppendCommand(text: string, opts: ConversationAppendOpts = {}) {
  const repoRoot = resolveRepoRoot(opts);
  const { config } = ConfigLoader.load(repoRoot);
  const sm = new SessionManager(repoRoot, config);
  const meta = sm.getMeta();
  if (!meta || !fs.existsSync(sm.files.dir)) {
    console.error("[relay-baton] no session. Run `relay-baton init`.");
    process.exit(2);
  }

  const event = new ConversationLog(repoRoot).append({
    role: parseRole(opts.role),
    kind: parseKind(opts.kind),
    text,
    sessionId: meta.id,
  });

  if (opts.json) {
    console.log(JSON.stringify(event, null, 2));
    return;
  }
  console.log(`[relay-baton] appended ${event.kind} event ${event.id}`);
}

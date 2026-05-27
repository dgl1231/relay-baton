import { SESSION_DIR, SESSION_FILES } from "@relay-baton/shared";

export const REFS = {
  fullLog: `${SESSION_DIR}/${SESSION_FILES.commandsLog}`,
  fullDiff: `${SESSION_DIR}/${SESSION_FILES.fullDiff}`,
  repoMap: `${SESSION_DIR}/${SESSION_FILES.repoMap}`,
  testResults: `${SESSION_DIR}/${SESSION_FILES.testResults}`,
  compactState: `${SESSION_DIR}/${SESSION_FILES.compactState}`,
  handoff: `${SESSION_DIR}/${SESSION_FILES.handoff}`,
  changedFiles: `${SESSION_DIR}/${SESSION_FILES.changedFiles}`,
};

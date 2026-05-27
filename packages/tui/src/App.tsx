import * as React from "react";
import { Box, Text, useApp, useInput } from "ink";
import * as fs from "fs";
import { ConfigLoader, SessionManager } from "@relay-baton/core";

function readSafe(p: string, max = 4000): string {
  try {
    const s = fs.readFileSync(p, "utf8");
    return s.length > max ? "..." + s.slice(s.length - max) : s;
  } catch { return ""; }
}

export function App() {
  const { exit } = useApp();
  const [tick, setTick] = React.useState(0);

  useInput((input) => {
    if (input === "q" || input === "Q") exit();
  });

  React.useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 1500);
    return () => clearInterval(t);
  }, []);

  const repoRoot = process.cwd();
  const { config } = ConfigLoader.load(repoRoot);
  const sm = new SessionManager(repoRoot, config);
  const meta = sm.getMeta();
  const task = readSafe(sm.files.p("task"), 1200);
  const compact = readSafe(sm.files.p("compactState"), 2400) || readSafe(sm.files.p("state"), 2400);
  const changed = readSafe(sm.files.p("changedFiles"), 1200);
  const logTail = readSafe(sm.files.p("commandsLog"), 2400);
  let budgetText = "";
  try {
    const b = JSON.parse(fs.readFileSync(sm.files.p("contextBudget"), "utf8"));
    budgetText = `profile=${b.profile} handoff=${b.used?.handoff}/${b.maxHandoffChars} truncated=${b.truncated}`;
  } catch { budgetText = "(no budget snapshot)"; }

  return (
    <Box flexDirection="column">
      <Box>
        <Box width={32} flexDirection="column" borderStyle="round" paddingX={1}>
          <Text bold>relay-baton</Text>
          <Text>repo: {repoRoot}</Text>
          <Text>status: {meta?.status ?? "-"}</Text>
          <Text>active: {meta?.activeAgent ?? "-"}</Text>
          <Text>last: {meta?.lastAgent ?? "-"}</Text>
          <Text>primary: {meta?.primaryAgent ?? "-"}</Text>
          <Text>fallback: {meta?.fallbackAgent ?? "-"}</Text>
          <Text>profile: {meta?.tokenDietProfile ?? "-"}</Text>
          <Text dimColor>tick {tick}</Text>
        </Box>
        <Box flexDirection="column" flexGrow={1}>
          <Box borderStyle="round" paddingX={1} flexDirection="column">
            <Text bold>Task</Text>
            <Text>{task.trim() || "(none)"}</Text>
          </Box>
          <Box borderStyle="round" paddingX={1} flexDirection="column">
            <Text bold>Compact State</Text>
            <Text>{compact.trim() || "(none)"}</Text>
          </Box>
          <Box borderStyle="round" paddingX={1} flexDirection="column">
            <Text bold>Changed Files</Text>
            <Text>{changed.trim() || "(none)"}</Text>
          </Box>
          <Box borderStyle="round" paddingX={1} flexDirection="column">
            <Text bold>commands.log (tail)</Text>
            <Text>{logTail.trim() || "(empty)"}</Text>
          </Box>
        </Box>
      </Box>
      <Box paddingX={1}>
        <Text dimColor>{budgetText}  —  press q to quit</Text>
      </Box>
    </Box>
  );
}

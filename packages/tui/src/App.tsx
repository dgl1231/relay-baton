import * as React from "react";
import { Box, Text, useApp, useInput } from "ink";
import * as fs from "fs";
import { spawnSync } from "child_process";
import { ConfigLoader, SessionManager } from "@relay-baton/core";

function readSafe(p: string, max = 4000): string {
  try {
    const s = fs.readFileSync(p, "utf8");
    return s.length > max ? "..." + s.slice(s.length - max) : s;
  } catch { return ""; }
}

function which(cmd: string): boolean {
  const r = spawnSync(cmd, ["--version"], { encoding: "utf8" });
  return r.error == null;
}

function statusColor(status?: string): "green" | "yellow" | "red" | "cyan" | "white" {
  switch (status) {
    case "completed": return "green";
    case "running":
    case "running_fallback": return "cyan";
    case "fallback_detected":
    case "handoff_ready": return "yellow";
    case "failed": return "red";
    default: return "white";
  }
}

export function App() {
  const { exit } = useApp();
  const [tick, setTick] = React.useState(0);

  useInput((input) => {
    if (input === "q" || input === "Q") exit();
    if (input === "r" || input === "R") setTick(x => x + 1);
  });

  React.useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 2000);
    return () => clearInterval(t);
  }, []);

  const repoRoot = process.cwd();
  const { config } = ConfigLoader.load(repoRoot);
  const sm = new SessionManager(repoRoot, config);
  const meta = sm.getMeta();
  const task = readSafe(sm.files.p("task"), 800);
  const compact = readSafe(sm.files.p("compactState"), 1600) || readSafe(sm.files.p("state"), 1600);
  const changed = readSafe(sm.files.p("changedFiles"), 800);
  const logTail = readSafe(sm.files.p("commandsLog"), 1600);

  const [agents] = React.useState(() => ({
    codex: which(config.agents.codex?.command ?? "codex"),
    claude: which(config.agents.claude?.command ?? "claude"),
  }));

  let budget: any = null;
  try { budget = JSON.parse(fs.readFileSync(sm.files.p("contextBudget"), "utf8")); } catch {/**/}

  return (
    <Box flexDirection="column">
      {/* Header bar */}
      <Box borderStyle="round" borderColor="cyan" paddingX={1}>
        <Text bold color="cyanBright">⚡ relay-baton</Text>
        <Text dimColor>  Codex → Claude handoff harness</Text>
      </Box>

      <Box>
        {/* Left column */}
        <Box width={36} flexDirection="column">
          <Box borderStyle="round" paddingX={1} flexDirection="column">
            <Text bold>Session</Text>
            <Text dimColor>{repoRoot}</Text>
            <Box marginTop={1} flexDirection="column">
              <Text>status:   <Text color={statusColor(meta?.status)}>{meta?.status ?? "-"}</Text></Text>
              <Text>active:   <Text color="cyan">{meta?.activeAgent ?? "-"}</Text></Text>
              <Text>last:     <Text>{meta?.lastAgent ?? "-"}</Text></Text>
              <Text>primary:  <Text>{meta?.primaryAgent ?? "-"}</Text></Text>
              <Text>fallback: <Text>{meta?.fallbackAgent ?? "-"}</Text></Text>
              <Text>profile:  <Text color="magenta">{meta?.tokenDietProfile ?? "-"}</Text></Text>
            </Box>
          </Box>

          <Box borderStyle="round" paddingX={1} flexDirection="column">
            <Text bold>Agents</Text>
            <Text>
              codex   {agents.codex ? <Text color="green">✓ available</Text> : <Text color="red">✗ missing</Text>}
            </Text>
            <Text>
              claude  {agents.claude ? <Text color="green">✓ available</Text> : <Text color="red">✗ missing</Text>}
            </Text>
            {(!agents.codex || !agents.claude) && (
              <Text dimColor>run: relay-baton login</Text>
            )}
          </Box>

          <Box borderStyle="round" paddingX={1} flexDirection="column">
            <Text bold>Budget</Text>
            {budget ? (
              <>
                <Text>profile: <Text color="magenta">{budget.profile}</Text></Text>
                <Text>handoff: {budget.used?.handoff}/{budget.maxHandoffChars}</Text>
                <Text>truncated: <Text color={budget.truncated ? "yellow" : "green"}>{String(!!budget.truncated)}</Text></Text>
              </>
            ) : (
              <Text dimColor>(no snapshot — run handoff)</Text>
            )}
          </Box>
        </Box>

        {/* Right column */}
        <Box flexDirection="column" flexGrow={1}>
          <Box borderStyle="round" paddingX={1} flexDirection="column">
            <Text bold color="yellow">Task</Text>
            <Text>{task.trim() || "(none)"}</Text>
          </Box>
          <Box borderStyle="round" paddingX={1} flexDirection="column">
            <Text bold color="yellow">Compact State</Text>
            <Text>{compact.trim() || "(none)"}</Text>
          </Box>
          <Box borderStyle="round" paddingX={1} flexDirection="column">
            <Text bold color="yellow">Changed Files</Text>
            <Text>{changed.trim() || "(none)"}</Text>
          </Box>
          <Box borderStyle="round" paddingX={1} flexDirection="column">
            <Text bold color="yellow">commands.log (tail)</Text>
            <Text>{logTail.trim() || "(empty)"}</Text>
          </Box>
        </Box>
      </Box>

      <Box paddingX={1}>
        <Text dimColor>tick {tick}  ·  </Text>
        <Text color="cyan">r</Text><Text dimColor> refresh   </Text>
        <Text color="cyan">q</Text><Text dimColor> quit</Text>
      </Box>
    </Box>
  );
}

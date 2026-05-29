import * as React from "react";
import { Box, Text } from "ink";

export interface ModePanelProps {
  mode: string;
  planStatus: string;
  compressStatus: string;
  latestHandoff: string;
}

function modeColor(mode: string): "green" | "yellow" | "cyan" | "magenta" | "white" {
  switch (mode) {
    case "run": return "cyan";
    case "plan": return "magenta";
    case "execute": return "yellow";
    case "compress-context": return "green";
    case "handoff": return "yellow";
    default: return "white";
  }
}

/** Display-only panel for v0.6: current workflow mode + plan/compress/handoff state. */
export function ModePanel(props: ModePanelProps) {
  return (
    <Box borderStyle="round" paddingX={1} flexDirection="column">
      <Text bold color="cyan">Mode</Text>
      <Text>mode: <Text color={modeColor(props.mode)}>{props.mode}</Text></Text>
      <Text>plan: {props.planStatus}</Text>
      <Text>compress: {props.compressStatus}</Text>
      <Text>last handoff: {props.latestHandoff}</Text>
    </Box>
  );
}

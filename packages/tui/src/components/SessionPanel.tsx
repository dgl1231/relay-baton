import * as React from "react";
import { Box, Text } from "ink";
import type { SessionMeta } from "@relay-baton/shared";

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

export function SessionPanel(props: { task: string; meta: SessionMeta | null; repoRoot: string; fallbackReason: string | null }) {
  return (
    <Box borderStyle="round" paddingX={1} flexDirection="column">
      <Text bold color="yellow">Session</Text>
      <Text>task: {props.task.trim() || "(none)"}</Text>
      <Text>status: <Text color={statusColor(props.meta?.status)}>{props.meta?.status ?? "-"}</Text>  active: {props.meta?.activeAgent ?? "-"}</Text>
      <Text>fallback: {props.fallbackReason ?? "(none)"}</Text>
      <Text dimColor>{props.repoRoot}</Text>
    </Box>
  );
}

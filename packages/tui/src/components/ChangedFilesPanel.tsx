import * as React from "react";
import { Box, Text } from "ink";

export function ChangedFilesPanel(props: { changed: string; compact: string }) {
  return (
    <Box borderStyle="round" paddingX={1} flexDirection="column">
      <Text bold color="yellow">Changed Files / Compact State</Text>
      <Text>{props.changed.trim() || "(no changed files snapshot)"}</Text>
      <Text dimColor>{props.compact.trim() || "(no compact state)"}</Text>
    </Box>
  );
}

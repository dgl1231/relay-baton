export async function tuiCommand() {
  try {
    const mod = await import("@relay-baton/tui");
    await mod.startTui();
  } catch (e: any) {
    console.error("[relay-baton] failed to start TUI:", e?.message ?? e);
    process.exit(1);
  }
}

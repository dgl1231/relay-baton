export async function tuiCommand(opts: { project?: string; path?: string } = {}) {
  try {
    const mod = await import("@relay-baton/tui");
    await mod.startTui(opts);
  } catch (e: any) {
    console.error("[relay-baton] failed to start TUI:", e?.message ?? e);
    process.exit(1);
  }
}

/**
 * v2.8 — Friendly CLI output helpers. Zero dependencies: plain ANSI codes,
 * auto-disabled when stdout is not a TTY or NO_COLOR is set, so piped/CI
 * output stays clean and machine-readable. Display only — no logic here.
 */

const colorEnabled = !!process.stdout.isTTY && !process.env.NO_COLOR;

const ESC = String.fromCharCode(27); // ANSI escape, kept out of the source literally
const wrap = (code: number, close = 39) => (s: string) =>
  colorEnabled ? `${ESC}[${code}m${s}${ESC}[${close}m` : s;

export const color = {
  dim: wrap(2, 22),
  bold: wrap(1, 22),
  red: wrap(31),
  green: wrap(32),
  yellow: wrap(33),
  blue: wrap(34),
  magenta: wrap(35),
  cyan: wrap(36),
};

/** Consistent, friendly message vocabulary (stdout for progress, stderr for problems). */
export const ui = {
  /** Neutral progress/info line. */
  info(msg: string): void { console.log(`${color.cyan("●")} ${msg}`); },
  /** A step that is starting (command launch, hop, build). */
  step(msg: string): void { console.log(`${color.blue("→")} ${msg}`); },
  /** Positive completion. */
  ok(msg: string): void { console.log(`${color.green("✓")} ${msg}`); },
  /** Non-fatal warning (stderr). */
  warn(msg: string): void { console.error(`${color.yellow("▲")} ${msg}`); },
  /** Failure (stderr). */
  fail(msg: string): void { console.error(`${color.red("✗")} ${msg}`); },
  /** Dimmed follow-up hint under the previous line — what to try next. */
  hint(msg: string): void { console.log(color.dim(`  ↳ ${msg}`)); },
  /** Dimmed detail bullet under a warn/fail (stderr, aligned). */
  detail(msg: string): void { console.error(color.dim(`  · ${msg}`)); },
  /** Section heading for a new phase of work. */
  heading(msg: string): void { console.log(`\n${color.bold(msg)}`); },
  /** Render a relay chain like "codex → claude" with the active hop highlighted. */
  chain(ids: string[], activeIndex = -1): string {
    return ids
      .map((id, i) => (i === activeIndex ? color.bold(color.cyan(id)) : id))
      .join(color.dim(" → "));
  },
};

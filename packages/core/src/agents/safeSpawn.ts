import crossSpawn from "cross-spawn";

/**
 * Cross-platform-safe process spawn for agent CLIs.
 *
 * relay-baton spawns `codex` / `claude` (etc.) with `shell:false` to avoid shell
 * injection from the task/prompt argument. On Windows that is not enough on its
 * own: npm-global CLIs are installed as `.cmd` shims, and
 *   - Node's `shell:false` lookup only auto-appends `.exe`, not `.cmd`/`.bat`
 *     (→ ENOENT, so `doctor` wrongly reports the agent missing), and
 *   - since CVE-2024-27980, spawning a `.cmd`/`.bat` without a shell throws
 *     EINVAL, while `shell:true` does NOT escape arguments (DEP0190 → injection).
 *
 * `cross-spawn` resolves the executable via PATH+PATHEXT and routes `.cmd`/`.bat`
 * through `cmd.exe` with correct argument escaping, all with `shell:false`.
 * Centralizing it here keeps every agent spawn path consistent and safe.
 */
export const safeSpawn = crossSpawn;
export const safeSpawnSync = crossSpawn.sync;

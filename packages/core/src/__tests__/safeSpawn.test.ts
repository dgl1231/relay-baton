import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { safeSpawnSync } from "../agents/safeSpawn";

const onWin = process.platform === "win32";

describe("safeSpawn", () => {
  it("runs a normal executable and captures output", () => {
    const r = safeSpawnSync("node", ["--version"], { encoding: "utf8" });
    expect(r.error).toBeFalsy();
    expect(String(r.stdout)).toMatch(/^v?\d+\./);
  });

  // Windows-only: npm-global CLIs are .cmd shims. Node's shell:false lookup only
  // auto-appends .exe, and .cmd can't run without a shell — so a plain
  // child_process spawn fails with ENOENT/EINVAL. safeSpawn must resolve and run
  // the .cmd, AND must not let argument content inject a second command.
  it.skipIf(!onWin)("resolves a .cmd on PATH and does not inject via arguments", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-safespawn-"));
    fs.writeFileSync(path.join(dir, "foo.cmd"), "@echo ok\r\n");
    const marker = path.join(dir, "pwned.txt");
    const env = { ...process.env, PATH: dir + path.delimiter + (process.env.PATH ?? "") };

    const r = safeSpawnSync("foo", [`x & echo pwned> ${marker}`], { encoding: "utf8", env });

    expect(r.error).toBeFalsy();                       // .cmd was resolved + ran
    expect(String(r.stdout)).toMatch(/ok/);
    expect(fs.existsSync(marker)).toBe(false);         // argument did not inject a command
  });
});

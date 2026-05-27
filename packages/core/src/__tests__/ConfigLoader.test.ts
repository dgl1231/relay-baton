import { describe, it, expect } from "vitest";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import { ConfigLoader } from "../config/ConfigLoader";
import { defaultConfig } from "../config/defaultConfig";

describe("ConfigLoader", () => {
  it("returns default when no file", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-"));
    const r = ConfigLoader.load(dir);
    expect(r.source).toBe("default");
    expect(r.config.primaryAgent).toBe("codex");
    expect(r.config.tokenDiet.profile).toBe("balanced");
  });
  it("merges file overrides", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-"));
    fs.writeFileSync(
      path.join(dir, "relay-baton.config.json"),
      JSON.stringify({ tokenDiet: { profile: "caveman" } }),
    );
    const r = ConfigLoader.load(dir);
    expect(r.source).toBe("file");
    expect(r.config.tokenDiet.profile).toBe("caveman");
    expect(r.config.tokenDiet.profiles.balanced.maxHandoffChars)
      .toBe(defaultConfig.tokenDiet.profiles.balanced.maxHandoffChars);
  });
});

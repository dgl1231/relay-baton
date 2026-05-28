import * as fs from "fs";
import * as path from "path";
import type { RelayBatonConfig, DietProfile } from "@relay-baton/shared";
import { defaultConfig } from "./defaultConfig";

export class ConfigLoader {
  static load(repoRoot: string): { config: RelayBatonConfig; source: "default" | "file"; error?: string } {
    const cfgPath = path.join(repoRoot, "relay-baton.config.json");
    if (!fs.existsSync(cfgPath)) {
      return { config: defaultConfig, source: "default" };
    }
    try {
      const raw = fs.readFileSync(cfgPath, "utf8");
      const parsed = JSON.parse(raw);
      return { config: this.merge(defaultConfig, parsed), source: "file" };
    } catch (e: any) {
      return { config: defaultConfig, source: "default", error: e?.message ?? String(e) };
    }
  }

  static merge(base: RelayBatonConfig, override: Partial<RelayBatonConfig>): RelayBatonConfig {
    return {
      ...base,
      ...override,
      agents: { ...base.agents, ...(override.agents ?? {}) },
      authPolicy: { ...base.authPolicy, ...(override.authPolicy ?? {}) },
      commands: { ...base.commands, ...(override.commands ?? {}) },
      fallbackPatterns: override.fallbackPatterns ?? base.fallbackPatterns,
      tokenDiet: {
        ...base.tokenDiet,
        ...(override.tokenDiet ?? {}),
        profiles: {
          ...base.tokenDiet.profiles,
          ...((override.tokenDiet?.profiles as Record<string, DietProfile>) ?? {}),
        },
      },
      planExecute: override.planExecute
        ? { ...base.planExecute, ...override.planExecute }
        : base.planExecute,
    };
  }
}

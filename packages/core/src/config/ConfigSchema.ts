import type { AgentId, DietProfileName, RelayBatonConfig } from "@relay-baton/shared";
import { CONFIG_VERSION } from "@relay-baton/shared";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

const AGENT_IDS: ReadonlySet<string> = new Set<AgentId>([
  "codex", "claude", "opencode", "gemini", "aider",
]);
const DIET_NAMES: ReadonlySet<string> = new Set<DietProfileName>([
  "off", "lite", "balanced", "caveman", "ultra",
]);

/**
 * v1.0 frozen config contract validator. Deterministic and pure: it never
 * reads the filesystem and never spawns anything. `errors` are contract
 * violations; `warnings` are forward-compat or safety-policy notes.
 */
export function validateConfig(config: RelayBatonConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const v = config.configVersion ?? 1;
  if (!Number.isInteger(v) || v < 1) {
    errors.push(`configVersion must be a positive integer (got ${config.configVersion})`);
  } else if (v > CONFIG_VERSION) {
    warnings.push(`configVersion ${v} is newer than supported ${CONFIG_VERSION}; some fields may be ignored`);
  }

  if (!AGENT_IDS.has(config.primaryAgent)) errors.push(`primaryAgent is not a known agent: ${config.primaryAgent}`);
  if (!AGENT_IDS.has(config.fallbackAgent)) errors.push(`fallbackAgent is not a known agent: ${config.fallbackAgent}`);

  if (!config.agents || typeof config.agents !== "object") {
    errors.push("agents map is missing");
  } else {
    for (const id of [config.primaryAgent, config.fallbackAgent]) {
      if (id && !config.agents[id]) errors.push(`agents map has no entry for "${id}"`);
    }
    for (const [id, a] of Object.entries(config.agents)) {
      if (!a || typeof a.command !== "string" || !a.command) errors.push(`agents.${id}.command must be a non-empty string`);
      if (!Array.isArray(a?.args)) errors.push(`agents.${id}.args must be an array`);
    }
  }

  if (!Array.isArray(config.fallbackPatterns) || config.fallbackPatterns.length === 0) {
    warnings.push("fallbackPatterns is empty; fallback detection will never trigger");
  }

  // Safety policy (mirrors CLAUDE.md): blocked env vars must stay blocked.
  const blocked = config.authPolicy?.blockedEnvVars ?? [];
  for (const required of ["OPENAI_API_KEY", "ANTHROPIC_API_KEY"]) {
    if (!blocked.includes(required)) warnings.push(`authPolicy.blockedEnvVars should include ${required}`);
  }

  const td = config.tokenDiet;
  if (!td || typeof td !== "object") {
    errors.push("tokenDiet is missing");
  } else {
    if (!DIET_NAMES.has(td.profile)) errors.push(`tokenDiet.profile is not a known diet: ${td.profile}`);
    if (!td.profiles || typeof td.profiles !== "object") {
      errors.push("tokenDiet.profiles is missing");
    } else if (td.profile !== "off" && !td.profiles[td.profile]) {
      errors.push(`tokenDiet.profiles has no entry for active profile "${td.profile}"`);
    }
  }

  const cc = config.contextCompression;
  if (cc) {
    if (typeof cc.threshold !== "number" || cc.threshold < 0 || cc.threshold > 1) {
      errors.push(`contextCompression.threshold must be in [0,1] (got ${cc.threshold})`);
    }
    for (const [agent, t] of Object.entries(cc.perAgent ?? {})) {
      if (typeof t !== "number" || t < 0 || t > 1) {
        errors.push(`contextCompression.perAgent.${agent} must be in [0,1] (got ${t})`);
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * Normalize a (possibly legacy) config up to the current contract version.
 * Pure; does not validate. Currently only stamps the version when absent.
 */
export function normalizeConfig(config: RelayBatonConfig): RelayBatonConfig {
  if (config.configVersion === CONFIG_VERSION) return config;
  return { ...config, configVersion: CONFIG_VERSION };
}

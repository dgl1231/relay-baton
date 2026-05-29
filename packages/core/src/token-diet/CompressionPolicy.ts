import type { AgentId, RelayBatonConfig } from "@relay-baton/shared";

/** Global fallback when config carries no contextCompression.threshold. */
export const DEFAULT_COMPRESSION_THRESHOLD = 0.8;

function clamp01(n: number, fallback: number): number {
  if (!Number.isFinite(n) || n < 0 || n > 1) return fallback;
  return n;
}

/**
 * Resolve the compression threshold for a given agent (v0.9 adaptive policy).
 * Precedence: per-agent override → global config threshold → DEFAULT.
 * Deterministic and pure; values are clamped to [0, 1].
 */
export function resolveCompressionThreshold(
  config: Pick<RelayBatonConfig, "contextCompression">,
  agent?: AgentId,
): number {
  const cc = config.contextCompression;
  const global = clamp01(cc?.threshold ?? DEFAULT_COMPRESSION_THRESHOLD, DEFAULT_COMPRESSION_THRESHOLD);
  if (!agent) return global;
  const perAgent = cc?.perAgent?.[agent];
  if (perAgent === undefined) return global;
  return clamp01(perAgent, global);
}

import { createHash } from "node:crypto";
import { inspectContext } from "./inspect";
import { countEventTokens, getModelProfile } from "./models";
import type {
  AgentKind,
  InterventionResult,
  RecoveryRecord,
  TraceEvent,
} from "./types";

function recoveryHandle(content: string): { handle: string; sha256: string } {
  const sha256 = createHash("sha256").update(content, "utf8").digest("hex");
  return { sha256, handle: `cp_${sha256.slice(0, 20)}` };
}

export function applyStaleToolOutputPolicy(
  events: TraceEvent[],
  options: {
    modelId?: string;
    agent?: AgentKind;
    keepRecent?: number;
    minimumTokens?: number;
  } = {}
): InterventionResult {
  const started = performance.now();
  const model = getModelProfile(options.modelId);
  const keepRecent = Math.max(1, options.keepRecent ?? 3);
  const minimumTokens = Math.max(1, options.minimumTokens ?? 256);
  const inspection = inspectContext(events, {
    modelId: model.id,
    agent: options.agent,
  });
  const profiles = new Map(inspection.events.map((profile) => [profile.id, profile]));

  const eligibleIndices = events
    .map((event, index) => ({ event, index, profile: profiles.get(event.id) }))
    .filter(
      ({ event, profile }) =>
        event.role === "tool" &&
        !!profile &&
        profile.tokens >= minimumTokens &&
        ["tool_output", "log", "structured_data"].includes(profile.category)
    )
    .map(({ index }) => index);
  const staleIndices = new Set(
    eligibleIndices.slice(0, Math.max(0, eligibleIndices.length - keepRecent))
  );

  const recovery: Record<string, RecoveryRecord> = {};
  let passedThrough = 0;

  const transformed = events.map((event, index) => {
    if (!staleIndices.has(index)) return { ...event };

    const originalTokens = countEventTokens(event, model);
    const { handle, sha256 } = recoveryHandle(event.content);
    const marker =
      `[ContextProof cleared stale tool output: ${handle}; ` +
      `sha256=${sha256}; retrieve exact bytes on demand]`;
    const candidate = { ...event, content: marker };

    if (countEventTokens(candidate, model) >= originalTokens) {
      passedThrough += 1;
      return { ...event };
    }

    recovery[handle] = {
      handle,
      eventId: event.id,
      sha256,
      original: event.content,
      originalTokens,
    };
    return candidate;
  });

  const originalTokens = events.reduce(
    (sum, event) => sum + countEventTokens(event, model),
    0
  );
  const resultingTokens = transformed.reduce(
    (sum, event) => sum + countEventTokens(event, model),
    0
  );
  const savedTokens = originalTokens - resultingTokens;

  return {
    policy: "stale-tool-output-v1",
    events: transformed,
    recovery,
    originalTokens,
    resultingTokens,
    savedTokens,
    savedPercent:
      originalTokens > 0
        ? Math.round((savedTokens / originalTokens) * 10_000) / 100
        : 0,
    processingMs: Math.round((performance.now() - started) * 1000) / 1000,
    passedThrough,
  };
}

export function retrieveExact(
  handle: string,
  recovery: Record<string, RecoveryRecord>
): string {
  const record = recovery[handle];
  if (!record) throw new Error(`Unknown recovery handle: ${handle}`);
  const actualHash = createHash("sha256")
    .update(record.original, "utf8")
    .digest("hex");
  if (actualHash !== record.sha256) {
    throw new Error(`Recovery integrity check failed for ${handle}.`);
  }
  return record.original;
}

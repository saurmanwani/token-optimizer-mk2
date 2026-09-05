import type {
  ContextInspection,
  PolicyRecommendation,
  TraceEvent,
} from "./types";

export function recommendPolicies(
  inspection: ContextInspection,
  events: TraceEvent[]
): PolicyRecommendation[] {
  const recommendations: PolicyRecommendation[] = [];
  const byId = new Map(events.map((event) => [event.id, event]));

  if (inspection.cacheablePrefixTokens > 1024) {
    recommendations.push({
      action: "cache",
      priority: "high",
      title: "Stabilize and cache the static prefix",
      rationale:
        "Instructions and tool schemas exceed 1,024 tokens. Keep stable content first and byte-identical to improve provider cache reuse.",
      estimatedTokensAffected: inspection.cacheablePrefixTokens,
      safety: "advisory",
    });
  }

  for (const profile of inspection.events) {
    const event = byId.get(profile.id);
    if (!event) continue;

    if (profile.duplicateOf) {
      recommendations.push({
        eventId: profile.id,
        action: "deduplicate",
        priority: "high",
        title: `Remove exact duplicate ${profile.id}`,
        rationale: `This event repeats ${profile.duplicateOf} byte-for-byte.`,
        estimatedTokensAffected: profile.tokens,
        safety: "lossless",
      });
      continue;
    }

    if (
      event.role === "tool" &&
      profile.tokens >= 256 &&
      ["log", "tool_output", "structured_data"].includes(profile.category)
    ) {
      recommendations.push({
        eventId: profile.id,
        action: "retrieve_on_demand",
        priority: profile.tokens >= 1000 ? "high" : "medium",
        title: `Move ${profile.id} behind retrieval`,
        rationale:
          "Large tool output is usually valuable once, but expensive when resent on every turn. Keep a recovery handle and retrieve exact bytes if needed.",
        estimatedTokensAffected: profile.tokens,
        safety: "recoverable",
      });
    }
  }

  const toolProfiles = inspection.events.filter(
    (profile) =>
      profile.role === "tool" &&
      ["log", "tool_output", "structured_data"].includes(profile.category)
  );
  if (toolProfiles.length > 3) {
    const stale = toolProfiles.slice(0, -3);
    recommendations.push({
      action: "clear_stale",
      priority: "high",
      title: "Clear stale tool outputs after three recent results",
      rationale:
        "Older tool payloads dominate active history. Replace eligible results with byte-exact local recovery handles.",
      estimatedTokensAffected: stale.reduce(
        (sum, profile) => sum + profile.tokens,
        0
      ),
      safety: "recoverable",
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      action: "preserve",
      priority: "low",
      title: "Preserve the current context",
      rationale:
        "No exact duplication, oversized tool output, or cacheable-prefix opportunity crossed the conservative thresholds.",
      estimatedTokensAffected: 0,
      safety: "advisory",
    });
  }

  return recommendations.sort((a, b) => {
    const rank = { high: 0, medium: 1, low: 2 };
    return rank[a.priority] - rank[b.priority];
  });
}

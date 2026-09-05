import {
  countEventTokens,
  estimateInputCost,
  getModelProfile,
} from "./models";
import type {
  AgentKind,
  CategoryProfile,
  ContextCategory,
  ContextInspection,
  EventProfile,
  TraceEvent,
} from "./types";

function looksLikeJson(content: string): boolean {
  const trimmed = content.trim();
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return false;
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

function classifyEvent(event: TraceEvent): ContextCategory {
  const name = (event.name ?? "").toLowerCase();
  const content = event.content;

  if (event.role === "system" || event.role === "developer") {
    return name.includes("tool") ? "tool_schema" : "instructions";
  }
  if (
    name.includes("schema") ||
    (content.includes('"inputSchema"') && content.includes('"properties"'))
  ) {
    return "tool_schema";
  }
  if (
    name.includes("shell") ||
    name.includes("terminal") ||
    /(^|\n)(error|warn|info|debug|fatal)(:|\s|\[)/i.test(content)
  ) {
    return "log";
  }
  if (
    name.includes("file") ||
    name.includes("code") ||
    /```[\s\S]*```/.test(content) ||
    /(^|\n)(import |export |class |function |def |package )/.test(content)
  ) {
    return "code";
  }
  if (looksLikeJson(content)) return "structured_data";
  if (event.role === "tool") return "tool_output";
  if (event.role === "user" || event.role === "assistant") return "conversation";
  return "other";
}

function cacheabilityFor(
  event: TraceEvent,
  category: ContextCategory
): EventProfile["cacheability"] {
  if (category === "instructions" || category === "tool_schema") return "high";
  if (event.role === "tool" || category === "log") return "low";
  return "medium";
}

export function inspectContext(
  events: TraceEvent[],
  options: { modelId?: string; agent?: AgentKind; generatedAt?: string } = {}
): ContextInspection {
  const model = getModelProfile(options.modelId);
  const seen = new Map<string, string>();
  let repeatedTokens = 0;
  let cacheablePrefixTokens = 0;
  let prefixOpen = true;

  const profiles: EventProfile[] = events.map((event) => {
    const category = classifyEvent(event);
    const tokens = countEventTokens(event, model);
    const duplicateOf = seen.get(event.content);
    if (duplicateOf) repeatedTokens += tokens;
    else seen.set(event.content, event.id);

    const cacheability = cacheabilityFor(event, category);
    if (prefixOpen && cacheability === "high") cacheablePrefixTokens += tokens;
    else if (event.role === "user" || event.role === "tool") prefixOpen = false;

    const reasons: string[] = [];
    if (duplicateOf) reasons.push(`Exact duplicate of ${duplicateOf}`);
    if (cacheability === "high") reasons.push("Stable prefix candidate");
    if (event.role === "tool" && tokens >= 500) reasons.push("Large tool result");
    if (category === "log") reasons.push("Log output can contain repeated noise");

    return {
      id: event.id,
      role: event.role,
      name: event.name,
      category,
      characters: event.content.length,
      tokens,
      estimatedInputCostUsd: estimateInputCost(tokens, model),
      duplicateOf,
      cacheability,
      reasons,
    };
  });

  const totalTokens = profiles.reduce((sum, profile) => sum + profile.tokens, 0);
  const categoryMap = new Map<
    ContextCategory,
    { events: number; tokens: number }
  >();
  for (const profile of profiles) {
    const current = categoryMap.get(profile.category) ?? { events: 0, tokens: 0 };
    current.events += 1;
    current.tokens += profile.tokens;
    categoryMap.set(profile.category, current);
  }

  const categories: CategoryProfile[] = [...categoryMap.entries()]
    .map(([category, data]) => ({
      category,
      ...data,
      sharePercent:
        totalTokens > 0 ? Math.round((data.tokens / totalTokens) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.tokens - a.tokens);

  const warnings: string[] = [];
  if (model.accuracyLabel === "provider-estimate") {
    warnings.push(
      `${model.displayName} counts are estimates; verify with provider-reported usage.`
    );
  }
  if (events.length === 0) warnings.push("No context events were found.");
  if (totalTokens > 0 && repeatedTokens / totalTokens > 0.15) {
    warnings.push("More than 15% of context is exact repetition.");
  }

  return {
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    agent: options.agent ?? "generic",
    model,
    eventCount: events.length,
    totalCharacters: events.reduce((sum, event) => sum + event.content.length, 0),
    totalTokens,
    estimatedInputCostUsd: estimateInputCost(totalTokens, model),
    repeatedTokens,
    repeatedSharePercent:
      totalTokens > 0 ? Math.round((repeatedTokens / totalTokens) * 1000) / 10 : 0,
    cacheablePrefixTokens,
    categories,
    events: profiles,
    warnings,
  };
}

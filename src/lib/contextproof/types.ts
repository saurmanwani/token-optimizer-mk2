export type AgentKind = "claude-code" | "cursor" | "codex" | "generic";
export type ContextCategory =
  | "instructions"
  | "tool_schema"
  | "tool_output"
  | "code"
  | "log"
  | "structured_data"
  | "conversation"
  | "other";

export type PolicyAction =
  | "preserve"
  | "cache"
  | "clear_stale"
  | "retrieve_on_demand"
  | "deduplicate";

export interface TraceEvent {
  id: string;
  role: "system" | "developer" | "user" | "assistant" | "tool" | "unknown";
  name?: string;
  content: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

export interface ModelProfile {
  id: string;
  provider: "openai" | "anthropic" | "google" | "open-source";
  displayName: string;
  inputUsdPerMillion: number;
  countingMethod: "tokenizer" | "estimate";
  accuracyLabel: "exact-family-tokenizer" | "provider-estimate";
}

export interface EventProfile {
  id: string;
  role: TraceEvent["role"];
  name?: string;
  category: ContextCategory;
  characters: number;
  tokens: number;
  estimatedInputCostUsd: number;
  duplicateOf?: string;
  cacheability: "high" | "medium" | "low";
  reasons: string[];
}

export interface CategoryProfile {
  category: ContextCategory;
  events: number;
  tokens: number;
  sharePercent: number;
}

export interface ContextInspection {
  generatedAt: string;
  agent: AgentKind;
  model: ModelProfile;
  eventCount: number;
  totalCharacters: number;
  totalTokens: number;
  estimatedInputCostUsd: number;
  repeatedTokens: number;
  repeatedSharePercent: number;
  cacheablePrefixTokens: number;
  categories: CategoryProfile[];
  events: EventProfile[];
  warnings: string[];
}

export interface PolicyRecommendation {
  eventId?: string;
  action: PolicyAction;
  priority: "high" | "medium" | "low";
  title: string;
  rationale: string;
  estimatedTokensAffected: number;
  safety: "lossless" | "recoverable" | "advisory";
}

export interface RecoveryRecord {
  handle: string;
  eventId: string;
  sha256: string;
  original: string;
  originalTokens: number;
}

export interface InterventionResult {
  policy: "stale-tool-output-v1";
  events: TraceEvent[];
  recovery: Record<string, RecoveryRecord>;
  originalTokens: number;
  resultingTokens: number;
  savedTokens: number;
  savedPercent: number;
  processingMs: number;
  passedThrough: number;
}

export interface BenchmarkFixture {
  id: string;
  category: ContextCategory;
  description: string;
  events: TraceEvent[];
  mustKeep: string[];
}

export interface BenchmarkCaseResult {
  fixtureId: string;
  category: ContextCategory;
  passed: boolean;
  originalTokens: number;
  resultingTokens: number;
  savedTokens: number;
  savedPercent: number;
  invariantsTotal: number;
  invariantsRetained: number;
  recoveryExact: boolean;
  processingMs: number;
  failures: string[];
}

export interface BenchmarkBaselineSummary {
  id: "none" | "recent-events-truncation" | "legacy-regex" | "stale-tool-output-v1";
  label: string;
  resultingTokens: number;
  savedPercent: number;
  invariantRetentionPercent: number;
  recoverable: boolean;
  notes: string;
}

export interface BenchmarkReport {
  generatedAt: string;
  benchmarkVersion: string;
  model: ModelProfile;
  fixtureTemplates: number;
  generatedCases: number;
  passedCases: number;
  failedCases: number;
  invariantRetentionPercent: number;
  byteExactRecoveryPercent: number;
  originalTokens: number;
  resultingTokens: number;
  savedTokens: number;
  savedPercent: number;
  meanProcessingMs: number;
  categoryDistribution: Record<string, number>;
  baselines: BenchmarkBaselineSummary[];
  limitations: string[];
  cases: BenchmarkCaseResult[];
}

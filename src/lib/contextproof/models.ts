import { encode } from "gpt-tokenizer";
import type { ModelProfile, TraceEvent } from "./types";

export const MODEL_PROFILES: Record<string, ModelProfile> = {
  "gpt-4.1": {
    id: "gpt-4.1",
    provider: "openai",
    displayName: "GPT-4.1",
    inputUsdPerMillion: 2,
    countingMethod: "tokenizer",
    accuracyLabel: "exact-family-tokenizer",
  },
  "gpt-4.1-mini": {
    id: "gpt-4.1-mini",
    provider: "openai",
    displayName: "GPT-4.1 mini",
    inputUsdPerMillion: 0.4,
    countingMethod: "tokenizer",
    accuracyLabel: "exact-family-tokenizer",
  },
  "claude-sonnet": {
    id: "claude-sonnet",
    provider: "anthropic",
    displayName: "Claude Sonnet",
    inputUsdPerMillion: 3,
    countingMethod: "estimate",
    accuracyLabel: "provider-estimate",
  },
  "gemini-flash": {
    id: "gemini-flash",
    provider: "google",
    displayName: "Gemini Flash",
    inputUsdPerMillion: 0.15,
    countingMethod: "estimate",
    accuracyLabel: "provider-estimate",
  },
  "llama-generic": {
    id: "llama-generic",
    provider: "open-source",
    displayName: "Open-source BPE model",
    inputUsdPerMillion: 0,
    countingMethod: "estimate",
    accuracyLabel: "provider-estimate",
  },
};

export function getModelProfile(modelId?: string): ModelProfile {
  return MODEL_PROFILES[modelId ?? "gpt-4.1"] ?? MODEL_PROFILES["gpt-4.1"];
}

function estimatedTokens(text: string, charsPerToken: number): number {
  if (!text) return 0;
  const punctuation = (text.match(/[{}\[\]():,.;/\\<>_=+-]/g) ?? []).length;
  const newlines = (text.match(/\n/g) ?? []).length;
  return Math.max(
    1,
    Math.ceil(text.length / charsPerToken + punctuation * 0.08 + newlines * 0.15)
  );
}

export function countModelTokens(text: string, model: ModelProfile): number {
  if (!text) return 0;
  if (model.provider === "openai") return encode(text).length;
  if (model.provider === "anthropic") return estimatedTokens(text, 3.55);
  if (model.provider === "google") return estimatedTokens(text, 3.9);
  return estimatedTokens(text, 3.65);
}

export function countEventTokens(event: TraceEvent, model: ModelProfile): number {
  const roleOverhead = model.provider === "openai" ? 4 : 3;
  return (
    countModelTokens(event.content, model) +
    countModelTokens(event.name ?? "", model) +
    roleOverhead
  );
}

export function estimateInputCost(tokens: number, model: ModelProfile): number {
  return (tokens / 1_000_000) * model.inputUsdPerMillion;
}

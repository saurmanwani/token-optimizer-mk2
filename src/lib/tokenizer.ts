import { encode } from "gpt-tokenizer";

export function countTokens(text: string): number {
  return encode(text).length;
}

export function estimateCost(
  tokens: number,
  model: string
): { input: number; output: number } {
  const pricing: Record<string, { input: number; output: number }> = {
    "gpt-4.1": { input: 2.0, output: 8.0 },
    "gpt-4.1-mini": { input: 0.4, output: 1.6 },
    "gpt-4o": { input: 2.5, output: 10.0 },
    "claude-sonnet": { input: 3.0, output: 15.0 },
    "claude-haiku": { input: 0.8, output: 4.0 },
    "gemini-flash": { input: 0.15, output: 0.6 },
    "gemini-pro": { input: 1.25, output: 5.0 },
  };

  const rate = pricing[model] ?? pricing["gpt-4.1"];
  return {
    input: (tokens / 1_000_000) * rate.input,
    output: (tokens / 1_000_000) * rate.output,
  };
}

export type TargetLLM = "claude" | "chatgpt" | "gemini" | "opensource" | "generic";

export type OptimizationMode = "quantitative" | "qualitative" | "both";

export type TaskType =
  | "classification"
  | "reasoning"
  | "coding"
  | "creative"
  | "extraction"
  | "multistep"
  | "qa"
  | "general";

export interface Change {
  description: string;
  technique: string;
  category: "filler_removal" | "structure" | "compression" | "technique" | "formatting";
}

export interface TokenStats {
  before: number;
  after: number;
  saved: number;
  percentSaved: number;
}

export interface OptimizationResult {
  optimizedPrompt: string;
  changes: Change[];
  tokenStats: TokenStats;
  taskType?: TaskType;
  techniquesApplied?: string[];
}

export interface OptimizeRequest {
  prompt: string;
  targetLLM: TargetLLM;
  mode: OptimizationMode;
  apiKey?: string;
}

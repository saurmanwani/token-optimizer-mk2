"use client";

import { useState } from "react";
import type {
  TargetLLM,
  OptimizationMode,
  OptimizationResult,
} from "@/lib/types";

const LLM_OPTIONS: { value: TargetLLM; label: string }[] = [
  { value: "chatgpt", label: "ChatGPT / GPT" },
  { value: "claude", label: "Claude" },
  { value: "gemini", label: "Gemini" },
  { value: "opensource", label: "Open Source (Llama, Mistral)" },
  { value: "generic", label: "Generic / Other" },
];

const MODE_OPTIONS: { value: OptimizationMode; label: string; desc: string }[] =
  [
    {
      value: "quantitative",
      label: "Quantitative",
      desc: "Reduce tokens & cost (rule-based, no LLM needed)",
    },
    {
      value: "qualitative",
      label: "Qualitative",
      desc: "Improve output quality (LLM-powered, needs API key)",
    },
    {
      value: "both",
      label: "Both",
      desc: "Token reduction + quality improvement",
    },
  ];

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [targetLLM, setTargetLLM] = useState<TargetLLM>("chatgpt");
  const [mode, setMode] = useState<OptimizationMode>("quantitative");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [warning, setWarning] = useState("");

  const needsApiKey = mode === "qualitative" || mode === "both";

  async function handleOptimize() {
    if (!prompt.trim()) return;
    setLoading(true);
    setError("");
    setWarning("");
    setResult(null);

    try {
      const res = await fetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          targetLLM,
          mode,
          apiKey: apiKey || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Optimization failed");
        return;
      }

      if (data.warning) {
        setWarning(data.warning);
      }

      setResult(data);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!result) return;
    navigator.clipboard.writeText(result.optimizedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-[var(--border)] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center font-bold text-white text-sm">
              TO
            </div>
            <div>
              <h1 className="text-lg font-semibold text-[var(--text-primary)]">
                Token Optimizer
              </h1>
              <p className="text-xs text-[var(--text-muted)]">
                Optimize prompts for cost and quality
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-6">
        {/* Controls Row */}
        <div className="flex flex-wrap gap-4 mb-6">
          {/* Target LLM */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[var(--text-secondary)]">
              Target LLM
            </label>
            <select
              value={targetLLM}
              onChange={(e) => setTargetLLM(e.target.value as TargetLLM)}
              className="bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
            >
              {LLM_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Mode */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[var(--text-secondary)]">
              Optimization Mode
            </label>
            <div className="flex gap-1 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg p-1">
              {MODE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setMode(opt.value)}
                  title={opt.desc}
                  className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                    mode === opt.value
                      ? "bg-[var(--accent)] text-white"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* API Key (BYOK) */}
          {needsApiKey && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--text-secondary)]">
                OpenAI API Key (BYOK)
              </label>
              <div className="flex gap-2">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)] w-64"
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                >
                  {showApiKey ? "Hide" : "Show"}
                </button>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Your key is sent directly to OpenAI, never stored.
              </p>
            </div>
          )}
        </div>

        {/* Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Column */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-[var(--text-secondary)]">
                Original Prompt
              </h2>
              {result && (
                <span className="text-xs text-[var(--text-muted)]">
                  {result.tokenStats.before} tokens
                </span>
              )}
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Paste your prompt here..."
              className="w-full min-h-[400px] bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)] resize-y font-mono leading-relaxed"
            />
            <button
              onClick={handleOptimize}
              disabled={loading || !prompt.trim()}
              className="w-full py-3 rounded-xl font-medium text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Optimizing...
                </span>
              ) : (
                "Optimize Prompt"
              )}
            </button>
          </div>

          {/* Output Column */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-[var(--text-secondary)]">
                Optimized Prompt
              </h2>
              {result && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[var(--text-muted)]">
                    {result.tokenStats.after} tokens
                  </span>
                  <button
                    onClick={handleCopy}
                    className="text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] font-medium"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
              )}
            </div>
            <div className="w-full min-h-[400px] bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4 text-sm font-mono leading-relaxed overflow-auto">
              {result ? (
                <pre className="whitespace-pre-wrap text-[var(--text-primary)]">
                  {result.optimizedPrompt}
                </pre>
              ) : (
                <p className="text-[var(--text-muted)]">
                  Optimized prompt will appear here...
                </p>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Warning */}
            {warning && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-3 text-sm text-yellow-400">
                {warning}
              </div>
            )}
          </div>
        </div>

        {/* Results Panel */}
        {result && (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Token Stats Card */}
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-5">
              <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-4">
                Token Savings
              </h3>
              <div className="flex items-end gap-3 mb-3">
                <span className="text-3xl font-bold text-[var(--green)]">
                  {result.tokenStats.percentSaved >= 0 ? "" : "+"}
                  {Math.abs(result.tokenStats.percentSaved)}%
                </span>
                <span className="text-sm text-[var(--text-muted)] mb-1">
                  {result.tokenStats.saved >= 0 ? "saved" : "added"}
                </span>
              </div>
              <div className="flex gap-4 text-sm">
                <div>
                  <span className="text-[var(--text-muted)]">Before: </span>
                  <span className="text-[var(--text-secondary)] font-mono">
                    {result.tokenStats.before}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)]">After: </span>
                  <span className="text-[var(--text-secondary)] font-mono">
                    {result.tokenStats.after}
                  </span>
                </div>
                <div>
                  <span className="text-[var(--text-muted)]">Saved: </span>
                  <span className="text-[var(--green)] font-mono">
                    {result.tokenStats.saved}
                  </span>
                </div>
              </div>
            </div>

            {/* Techniques Card */}
            {result.techniquesApplied && result.techniquesApplied.length > 0 && (
              <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-5">
                <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-4">
                  Techniques Applied
                </h3>
                {result.taskType && (
                  <p className="text-sm text-[var(--text-secondary)] mb-3">
                    Detected task:{" "}
                    <span className="text-[var(--accent)] font-medium">
                      {result.taskType}
                    </span>
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {result.techniquesApplied.map((t, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 bg-[var(--accent)]/15 text-[var(--accent)] rounded-md text-xs font-medium"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Changes Card */}
            <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-5 lg:col-span-1">
              <h3 className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-4">
                Changes Made ({result.changes.length})
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {result.changes.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)]">
                    No changes needed -- your prompt is already well-optimized.
                  </p>
                ) : (
                  result.changes.map((change, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span
                        className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                          change.category === "filler_removal"
                            ? "bg-[var(--red)]"
                            : change.category === "compression"
                              ? "bg-[var(--yellow)]"
                              : change.category === "technique"
                                ? "bg-[var(--green)]"
                                : "bg-[var(--accent)]"
                        }`}
                      />
                      <span className="text-[var(--text-secondary)]">
                        {change.description}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-[var(--text-muted)]">
          <span>Token Optimizer</span>
          <span>
            Quantitative mode is fully local. Qualitative mode uses your API key
            (BYOK).
          </span>
        </div>
      </footer>
    </div>
  );
}

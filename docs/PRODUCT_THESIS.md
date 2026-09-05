# ContextProof Product Thesis

## The category error

Prompt polishing, prompt optimization, context compression, memory, caching, and
context observability solve different problems. A single “optimize” button hides
the objective and makes success impossible to verify.

ContextProof focuses on one job:

> Show what occupies an agent's context, recommend what to preserve, cache,
> clear, or retrieve, and prove the policy against explicit invariants.

## Target user

The first user is an engineer or AI platform owner operating Claude Code,
Cursor, or Codex-style agents who sees rising token usage, premature compaction,
context rot, or inconsistent task completion and cannot explain why.

## Product principles

1. Measure before mutating.
2. Prefer retrieval and clearing over linguistic corruption.
3. Preserve code, paths, identifiers, errors, numbers, and secrets exactly.
4. Count total economics, including optimizer and reacquisition cost.
5. Fail open: an unsafe or ineffective transform returns the original.
6. Keep raw context local by default.
7. Publish methods, negative results, and limitations.

## Launch claim

ContextProof measures context waste and verifies a policy before enabling it.

This claim is intentionally narrower than “reduce tokens without quality loss.”
Downstream quality must be established per workload through replay or target
model evaluation.

## Business wedge

The free local inspector creates trust and distribution. A proprietary policy
engine can later monetize team-level controls, fleet analytics, governance,
signed policy rollout, and enterprise support. The durable opportunity is
context observability and policy—not generic prompt rewriting.

## Non-goals

- Automatically rewrite arbitrary natural language.
- Claim a universal compression percentage.
- Replace provider-native caching or compaction.
- Upload private traces by default.
- Build another coding agent.

# Principal PM Case Study: From Prompt Optimizer to ContextProof

## Situation

The initial product offered a web form that removed filler with regex rules or
asked one LLM to rewrite a prompt for another. It was easy to demonstrate but
made three incompatible promises: lower token cost, higher prompt quality, and
context cleaning.

Competitive and code review showed that the product had no quality evaluation,
used one tokenizer across model families, sent “local” prompts through a server,
and could mutate content it claimed to protect.

## Decision

The prompt-optimizer wedge was rejected rather than cosmetically improved.

The product was reframed around a measurable job: inspect coding-agent context,
recommend a policy, and verify preservation before mutation. The web interface
became an evidence surface; CLI and MCP became the workflow surfaces.

## Product principles chosen

- Narrow falsifiable claim over broad marketing
- Measurement before automation
- Recoverability over irreversible summarization
- Local data path over hosted BYOK
- Total economics over token count alone
- Public limitations over benchmark theater

## MVP delivered

- Trace normalization for JSON, message arrays, and JSONL
- Context bill of materials by source/category
- Provider-aware token accounting with accuracy labels
- Cache, deduplication, retrieval, and stale-output recommendations
- Reversible SHA-256 stale tool-output policy
- 120-case synthetic regression benchmark
- Local CLI and MCP-compatible server
- Benchmark report UI and machine-readable endpoint
- Public thesis, benchmark contract, security model, report, and launch brief

## What the data says

The synthetic-v1 policy removed 25.62% of active benchmark tokens while keeping
all declared invariants active or byte-exact recoverable. This proves the
implementation meets its synthetic regression contract. It does not prove that
an agent will retain task success on real repositories.

That distinction is the central product judgment.

## Trade-offs

The core is intended to remain proprietary, which reduces inspectability and
community-led distribution. To retain credibility, fixtures, methods,
limitations, and aggregate evidence must remain public. The free local inspector
must provide value without requiring users to upload sensitive traces.

## Next evidence gate

Run repeated real-agent tasks across Claude Code, Cursor, and Codex on at least
three repository types. Compare baseline, provider-native controls, and one
ContextProof policy. Measure task success, active tokens, cache reads, total
cost, latency, reacquisition, and invariant failures.

Automatic policy rollout should remain disabled until that gate passes.

## Principal-level signal

This project demonstrates category framing, willingness to invalidate the
initial solution, market and technical synthesis, privacy and unit-economics
judgment, measurable launch criteria, and a distribution strategy aligned with
developer workflow.

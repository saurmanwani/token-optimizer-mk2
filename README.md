# ContextProof

**Before you compress context, prove what the model can afford to forget.**

ContextProof is a local-first context inspector and policy evaluator for coding
agents. It explains where context tokens come from, recommends safe actions, and
benchmarks interventions against explicit preservation invariants.

This repository is a portfolio-grade product prototype. Its core promise is
narrow and falsifiable:

> ContextProof measures context waste and verifies a policy before enabling it.

It does not claim that fewer tokens automatically produce lower cost or better
answers.

## What ships

- `contextproof inspect cursor --latest` — inspect the latest Cursor session for
  the current workspace and open a local report
- `contextproof inspect claude-code --latest` and `contextproof inspect codex
  --latest` — equivalent local adapters
- `contextproof inspect <trace.json|trace.jsonl>` — context bill of materials
- `contextproof recommend <trace>` — advisory preserve/cache/clear/retrieve policy
- `contextproof benchmark` — deterministic baseline-versus-policy benchmark
- `contextproof intervene <trace>` — reversible stale tool-output clearing
- `contextproof mcp` — local MCP-compatible JSON-RPC server
- Next.js benchmark report and methodology explorer
- Provider-aware token accounting with explicit accuracy labels

## Quick start

```bash
npm install
npm run contextproof -- benchmark
npm run contextproof -- inspect cursor --latest
npm run contextproof -- inspect examples/sample-trace.json --model gpt-4.1
npm run dev
```

The CLI prints human-readable output by default. Add `--json` for machine-readable
output. Agent adapters support `--list`, `--latest`, and an explicit session ID:

```bash
npm run contextproof -- inspect cursor --list
npm run contextproof -- inspect cursor 6c5bae5b-72f1-4744-8e01-e4b70fc2d86d
npm run contextproof -- inspect claude-code --latest
npm run contextproof -- inspect codex --latest
```

Agent inspection writes a private aggregate-only HTML report under
`.contextproof/reports/` and opens it by default. Use `--no-open` to only write
the report. Discovery is scoped to the current workspace and requires no
configuration.

## Input format

ContextProof accepts a JSON array, `{ "events": [...] }`, common message arrays,
or JSONL. A normalized event looks like:

```json
{
  "id": "evt-1",
  "role": "tool",
  "name": "shell",
  "content": "large tool output",
  "timestamp": "2026-09-05T09:00:00Z"
}
```

## Privacy

Inspection, recommendations, deterministic benchmarks, and interventions run
locally. ContextProof does not require an API key or send trace content to a
hosted service. The optional report UI computes aggregate synthetic benchmark
results locally on the Next.js server process. Session reports do not render raw
messages or tool output, apply likely-secret redaction to displayed strings, and
never change the original agent session.

## Evidence policy

Benchmark methods, fixtures, invariants, failures, and limitations are public.
Synthetic benchmark results are not presented as proof of downstream model
quality. See:

- [Product thesis](docs/PRODUCT_THESIS.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Benchmark contract](docs/BENCHMARK_CONTRACT.md)
- [Limitations register](docs/LIMITATIONS.md)
- [State of Coding-Agent Context 2026](docs/STATE_OF_CODING_AGENT_CONTEXT_2026.md)
- [Security and privacy](docs/SECURITY.md)
- [MCP integration](docs/MCP.md)
- [Principal PM case study](docs/PRINCIPAL_PM_CASE_STUDY.md)
- [Launch brief](docs/LAUNCH_BRIEF.md)

## Legacy prototype

The original prompt-rewriting engines remain in `src/lib/engines` only as
historical baselines. They are not used by the ContextProof UI or CLI and should
not be treated as production-safe compressors.
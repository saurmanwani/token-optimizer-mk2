# ContextProof Architecture

## Data flow

```text
trace JSON/JSONL
  -> normalize inert records
  -> classify context sources
  -> model-aware accounting
  -> advisory recommendations
  -> optional stale-output intervention
  -> invariant and recovery benchmark
  -> CLI, MCP, or aggregate web report
```

## Boundaries

- `src/lib/contextproof/normalize.ts` parses common trace shapes without
  executing embedded content.
- `src/lib/contextproof/inspect.ts` produces the context bill of materials.
- `src/lib/contextproof/models.ts` owns model/counting/cost disclosure.
- `src/lib/contextproof/recommend.ts` produces non-mutating policies.
- `src/lib/contextproof/intervene.ts` owns the single reversible intervention.
- `src/lib/contextproof/benchmark.ts` compares no intervention, recent-event
  truncation, the historical regex baseline, and ContextProof.
- `src/cli/contextproof.ts` is the local CLI and MCP stdio entry point.
- `src/app/page.tsx` and `/api/report` expose synthetic aggregate evidence only.

The legacy prompt engines under `src/lib/engines` are historical baselines.
They are intentionally outside the ContextProof production path.

## Safety properties

- Unknown or small content passes through.
- An intervention that is not smaller passes through.
- Removed bytes are SHA-256-addressed and integrity-checked on retrieval.
- The web endpoint does not accept user traces.
- The CLI enforces a 25 MiB input limit.
- No provider key or network call is required.

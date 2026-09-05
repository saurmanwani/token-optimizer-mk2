# Limitations Register

Last updated: 5 September 2026

## Evidence

- The bundled 120 cases are deterministic variations of six synthetic
  templates, not 120 independent real-agent tasks.
- Invariant retention verifies that declared strings remain active or
  recoverable. It does not measure whether a model completes a task correctly.
- External compressors and provider-native compaction are described in research
  but are not executed by the offline suite.
- Processing latency excludes model calls, agent execution, persistent recovery
  I/O, and evidence reacquisition.

## Accounting

- OpenAI-family counts use `gpt-tokenizer`.
- Anthropic, Google, and open-source profiles are explicitly labeled estimates.
- Listed prices are configurable assumptions, not live provider billing data.
- Cacheability is inferred from message position and content class; real cache
  hits require provider-reported usage.

## Input support

- The generic adapter handles JSON arrays, common message containers, JSONL,
  and simple content-block arrays.
- Cursor, Claude Code, and Codex internal trace formats evolve and are not yet
  covered by versioned conformance fixtures.
- Inputs are loaded into memory and limited to 25 MiB.

## Intervention

- `stale-tool-output-v1` only clears older eligible tool outputs while retaining
  the three most recent eligible results.
- Recovery records are returned in memory/JSON; encrypted crash-safe storage is
  not implemented.
- A model does not automatically invoke recovery in the current benchmark.
- Policies are advisory unless the user explicitly runs `intervene`.

## Distribution

- The MCP server implements the small stdio surface needed for current smoke
  tests but has not completed an external protocol conformance suite.
- Release signing, SBOM publication, installers, auto-update, and Windows
  support are not implemented.
- The package is private and is not published to npm.

These limitations prevent a production-readiness or “no quality loss” claim.

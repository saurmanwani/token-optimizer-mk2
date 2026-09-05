# ContextProof Benchmark Contract

## Purpose

The benchmark compares a baseline context with a candidate policy. It measures
token reduction only after checking explicit preservation invariants.

## Required metrics

- Original and resulting tokens, with tokenizer and accuracy label
- Gross tokens removed and percentage reduction
- Invariant retention rate
- Number of recovery handles and byte-exact recovery rate
- Policy processing time
- Estimated input cost before and after
- Benchmark sample count and content-type distribution
- Failure list, including cases where the policy passed the original through

## Non-negotiable invariants

Fixtures can require exact preservation of:

1. Code and commands
2. File paths and identifiers
3. Error messages and stack frames
4. Security-relevant values and trust-boundary checks
5. Task-specific answer evidence

A fixture fails if any required string cannot be found either in active context
or through its advertised recovery handle.

## Baselines

Every result includes:

- No intervention
- Stale tool-output clearing with byte-exact local recovery

External systems may be added only when their version, configuration, execution
cost, and failure behavior are recorded.

## Fixture policy

The bundled benchmark is deterministic and synthetic. It is useful for
regression testing, not proof of real-agent task success. Public reports must
state the number of templates and generated variations separately.

Real-workload claims require:

- At least three agent environments
- At least three repository/workload types
- Repeated independent runs
- Target-task scoring
- Confidence intervals
- Full accounting for context reacquisition and compressor overhead

## Publication policy

Publish the fixture generator, scoring logic, aggregate results, failures,
limitations, and tested versions. Never remove a failed case from the
denominator without documenting the exclusion.

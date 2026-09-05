# Security and Privacy

## Data flow

ContextProof inspection, recommendation, benchmark, and intervention commands
run in the local process. They do not need provider credentials and do not send
trace content over the network.

The Cursor, Claude Code, and Codex adapters only read session files. They do not
write to, rename, lock, or delete agent history. Generated session reports live
under `.contextproof/reports/` with user-only file permissions.

The bundled Next.js report endpoint returns aggregate results generated from
synthetic fixtures. It does not accept or persist user traces.

## Recovery data

The stale-output intervention returns removed bytes in an in-memory result map
addressed by SHA-256. The CLI can write that result only when the user explicitly
redirects or saves its JSON output. Persistent encrypted recovery storage is not
implemented yet.

## Threat model

Context traces may contain:

- API keys and credentials
- Proprietary source code
- Customer data
- Malicious instructions embedded in tool output
- Large or malformed payloads

ContextProof treats trace content as inert data. It does not execute commands,
evaluate embedded code, or follow instructions found in traces.

## Safe defaults

- Advisory recommendations; no mutation by default
- Original passthrough when a transform is not smaller or cannot be recovered
- Byte-exact SHA-256 recovery handles
- Bounded CLI input size
- Aggregate-only local reports: raw messages and tool output are not rendered
- Likely-secret redaction on all displayed report strings
- Safe failure when an adapter recognizes no content records
- No telemetry
- No shared provider key

## Production gaps

Before enterprise deployment, add signed release artifacts, an SBOM,
dependency scanning, encrypted crash-safe recovery storage, policy signatures,
redaction controls, retention configuration, and independent security review.

Report vulnerabilities privately to the repository owner. Do not include trace
content or secrets in a report.

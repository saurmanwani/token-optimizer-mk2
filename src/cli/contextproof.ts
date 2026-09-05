#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import {
  discoverLocalSessions,
  loadLocalSession,
  selectLocalSession,
  type LoadedLocalSession,
  type SupportedAgent,
} from "../lib/contextproof/session-adapters";
import {
  openLocalReport,
  writeLocalReport,
} from "../lib/contextproof/local-report";
import type { TraceEvent } from "../lib/contextproof/types";
import {
  applyStaleToolOutputPolicy,
  detectAgent,
  inspectContext,
  normalizeTrace,
  parseTraceText,
  recommendPolicies,
  runBenchmark,
} from "../lib/contextproof";

const MAX_INPUT_BYTES = 25 * 1024 * 1024;

function argValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function modelId(): string {
  return argValue("--model") ?? "gpt-4.1";
}

function isSupportedAgent(value: string | undefined): value is SupportedAgent {
  return value === "cursor" || value === "claude-code" || value === "codex";
}

async function readTrace(path: string) {
  const stats = await import("node:fs/promises").then(({ stat }) => stat(path));
  if (stats.size > MAX_INPUT_BYTES) {
    throw new Error("Trace exceeds the 25 MiB local safety limit.");
  }
  const text = await readFile(path, "utf8");
  const raw = parseTraceText(text);
  const events = normalizeTrace(raw);
  if (events.length === 0) throw new Error("No usable events were found.");
  return { raw, events };
}

function printInspection(inspection: ReturnType<typeof inspectContext>) {
  console.log(`ContextProof inspection`);
  console.log(`Agent: ${inspection.agent}`);
  console.log(
    `Model: ${inspection.model.displayName} (${inspection.model.accuracyLabel})`
  );
  console.log(`Events: ${inspection.eventCount}`);
  console.log(`Tokens: ${inspection.totalTokens.toLocaleString()}`);
  console.log(`Repeated: ${inspection.repeatedSharePercent}%`);
  console.log(`Cacheable prefix: ${inspection.cacheablePrefixTokens.toLocaleString()}`);
  console.log(`Estimated input cost: $${inspection.estimatedInputCostUsd.toFixed(6)}`);
  console.log(`\nContext bill of materials`);
  for (const category of inspection.categories) {
    console.log(
      `- ${category.category}: ${category.tokens.toLocaleString()} tokens (${category.sharePercent}%)`
    );
  }
  for (const warning of inspection.warnings) console.log(`\nWarning: ${warning}`);
}

function printBenchmark(report: ReturnType<typeof runBenchmark>) {
  console.log(`ContextProof benchmark ${report.benchmarkVersion}`);
  console.log(
    `Cases: ${report.passedCases}/${report.generatedCases} passed (${report.fixtureTemplates} templates)`
  );
  console.log(`Invariant retention: ${report.invariantRetentionPercent}%`);
  console.log(`Byte-exact recovery: ${report.byteExactRecoveryPercent}%`);
  console.log(
    `Tokens: ${report.originalTokens.toLocaleString()} → ${report.resultingTokens.toLocaleString()} (${report.savedPercent}% saved)`
  );
  console.log(`Mean policy time: ${report.meanProcessingMs} ms/case`);
  console.log(`\nBaseline comparison`);
  for (const baseline of report.baselines) {
    console.log(
      `- ${baseline.label}: ${baseline.savedPercent}% saved, ${baseline.invariantRetentionPercent}% evidence retained, recovery=${baseline.recoverable ? "yes" : "no"}`
    );
  }
  console.log(`\nLimitations`);
  for (const limitation of report.limitations) console.log(`- ${limitation}`);
}

type RpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

function rpcResult(id: RpcRequest["id"], result: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function rpcError(id: RpcRequest["id"], code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

async function handleRpc(request: RpcRequest) {
  if (request.method === "initialize") {
    return rpcResult(request.id, {
      protocolVersion: "2025-06-18",
      capabilities: { tools: {} },
      serverInfo: { name: "contextproof", version: "0.1.0" },
    });
  }
  if (request.method === "notifications/initialized") return null;
  if (request.method === "tools/list") {
    return rpcResult(request.id, {
      tools: [
        {
          name: "contextproof_inspect",
          description: "Inspect agent context without sending or mutating it.",
          inputSchema: {
            type: "object",
            properties: {
              events: { type: "array" },
              model: { type: "string" },
            },
            required: ["events"],
          },
        },
        {
          name: "contextproof_recommend",
          description: "Recommend advisory context policies.",
          inputSchema: {
            type: "object",
            properties: {
              events: { type: "array" },
              model: { type: "string" },
            },
            required: ["events"],
          },
        },
        {
          name: "contextproof_stats",
          description: "Run the bundled deterministic benchmark.",
          inputSchema: {
            type: "object",
            properties: { model: { type: "string" } },
          },
        },
      ],
    });
  }
  if (request.method === "tools/call") {
    const params = request.params ?? {};
    const name = String(params.name ?? "");
    const args = (params.arguments ?? {}) as Record<string, unknown>;
    const model = typeof args.model === "string" ? args.model : "gpt-4.1";

    let payload: unknown;
    if (name === "contextproof_stats") {
      payload = runBenchmark(model);
    } else {
      const events = normalizeTrace(args.events);
      const inspection = inspectContext(events, { modelId: model });
      payload =
        name === "contextproof_inspect"
          ? inspection
          : name === "contextproof_recommend"
            ? recommendPolicies(inspection, events)
            : undefined;
      if (!payload) return rpcError(request.id, -32601, `Unknown tool: ${name}`);
    }
    return rpcResult(request.id, {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    });
  }
  return rpcError(request.id, -32601, `Unknown method: ${request.method}`);
}

async function serveMcp() {
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) continue;
    let response;
    try {
      response = await handleRpc(JSON.parse(line));
    } catch (error) {
      response = rpcError(
        null,
        -32603,
        error instanceof Error ? error.message : "Internal error"
      );
    }
    if (response) process.stdout.write(`${JSON.stringify(response)}\n`);
  }
}

function usage() {
  console.log(`ContextProof

Usage:
  contextproof inspect <trace.json|trace.jsonl> [--model MODEL] [--json]
  contextproof inspect cursor|claude-code|codex --latest [--no-open]
  contextproof inspect cursor|claude-code|codex --list
  contextproof inspect cursor|claude-code|codex <session-id> [--no-open]
  contextproof recommend <trace.json|trace.jsonl> [--model MODEL] [--json]
  contextproof recommend cursor|claude-code|codex --latest
  contextproof intervene <trace.json|trace.jsonl> [--model MODEL] [--json]
  contextproof benchmark [--model MODEL] [--json]
  contextproof mcp
`);
}

async function main() {
  const command = process.argv[2];
  const asJson = process.argv.includes("--json");

  if (!command || command === "help" || command === "--help") return usage();
  if (command === "mcp") return serveMcp();
  if (command === "benchmark") {
    const report = runBenchmark(modelId());
    if (asJson) console.log(JSON.stringify(report, null, 2));
    else printBenchmark(report);
    return;
  }

  const target = process.argv[3];
  if (!target) throw new Error(`${command} requires a trace file or agent name.`);
  let raw: unknown;
  let events: TraceEvent[];
  let loaded: LoadedLocalSession | undefined;

  if (isSupportedAgent(target)) {
    if (process.argv.includes("--list")) {
      const sessions = await discoverLocalSessions(target);
      if (asJson) console.log(JSON.stringify(sessions, null, 2));
      else if (sessions.length === 0) {
        console.log(`No ${target} sessions found for ${process.cwd()}.`);
      } else {
        console.log(`${target} sessions for ${process.cwd()}`);
        for (const session of sessions) {
          console.log(
            `- ${session.id} · ${new Date(session.modifiedAt).toLocaleString()} · ${session.bytes.toLocaleString()} bytes${session.workspaceMatch ? "" : " · workspace unverified"}`
          );
        }
      }
      return;
    }
    const positionalSelector =
      process.argv[4] && !process.argv[4].startsWith("--")
        ? process.argv[4]
        : undefined;
    const selector =
      argValue("--session") ??
      positionalSelector ??
      (process.argv.includes("--latest") ? "latest" : "latest");
    const session = await selectLocalSession(target, selector);
    loaded = await loadLocalSession(session);
    raw = { agent: target, sessionId: session.id };
    events = loaded.events;
  } else {
    ({ raw, events } = await readTrace(target));
  }
  const inspection = inspectContext(events, {
    modelId: modelId(),
    agent: loaded?.session.agent ?? detectAgent(raw),
  });
  if (
    loaded?.session.agent === "cursor" &&
    events.some((event) => event.name?.startsWith("tool_call:")) &&
    !events.some((event) => event.role === "tool")
  ) {
    inspection.warnings.push(
      "This Cursor transcript exposes tool calls but not tool-result payloads. " +
        "Tool-output totals are incomplete; no unscoped cache files were read."
    );
  }

  if (command === "inspect") {
    if (asJson) {
      console.log(
        JSON.stringify(
          loaded
            ? {
                source: {
                  session: loaded.session,
                  formatVersion: loaded.formatVersion,
                  skippedRecords: loaded.skippedRecords,
                },
                inspection,
              }
            : inspection,
          null,
          2
        )
      );
    } else {
      if (loaded) {
        console.log(
          `Selected ${loaded.session.agent} session: ${loaded.session.id}`
        );
        console.log(`Source: ${loaded.session.path}`);
        console.log(
          `Format: ${loaded.formatVersion}; source remains read-only`
        );
      }
      printInspection(inspection);
      if (loaded) {
        const recommendations = recommendPolicies(inspection, events);
        const reportPath = await writeLocalReport(
          loaded,
          inspection,
          recommendations
        );
        console.log(`\nLocal report: ${reportPath}`);
        if (!process.argv.includes("--no-open")) {
          try {
            await openLocalReport(reportPath);
            console.log("Opened the local report.");
          } catch (error) {
            console.log(
              `Could not open the report automatically: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
          }
        }
      }
    }
    return;
  }
  if (command === "recommend") {
    const recommendations = recommendPolicies(inspection, events);
    if (asJson) console.log(JSON.stringify(recommendations, null, 2));
    else {
      console.log("ContextProof recommendations");
      for (const item of recommendations) {
        console.log(
          `- [${item.priority}] ${item.title} — ${item.rationale} (${item.safety})`
        );
      }
    }
    return;
  }
  if (command === "intervene") {
    const result = applyStaleToolOutputPolicy(events, {
      modelId: modelId(),
      agent: inspection.agent,
    });
    if (asJson) console.log(JSON.stringify(result, null, 2));
    else {
      console.log("ContextProof stale-output intervention");
      console.log(
        `Tokens: ${result.originalTokens.toLocaleString()} → ${result.resultingTokens.toLocaleString()} (${result.savedPercent}% saved)`
      );
      console.log(`Recovery handles: ${Object.keys(result.recovery).length}`);
      console.log("Use --json to retain recovery records.");
    }
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(
    `ContextProof error: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exitCode = 1;
});

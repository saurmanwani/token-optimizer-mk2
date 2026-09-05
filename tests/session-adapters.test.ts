import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { inspectContext, recommendPolicies } from "../src/lib/contextproof";
import {
  loadLocalSession,
  type LocalSession,
  type SupportedAgent,
  workspaceSlug,
} from "../src/lib/contextproof/session-adapters";
import {
  redactSecrets,
  writeLocalReport,
} from "../src/lib/contextproof/local-report";

const FIXTURES = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures"
);

test("encodes workspace paths like Cursor and Claude Code", () => {
  const workspace =
    "/Users/saurabh/Builder Mode/Code_Experiments/token-optimizer-mk2";
  assert.equal(
    workspaceSlug(workspace, false),
    "Users-saurabh-Builder-Mode-Code-Experiments-token-optimizer-mk2"
  );
  assert.equal(
    workspaceSlug(workspace, true),
    "-Users-saurabh-Builder-Mode-Code-Experiments-token-optimizer-mk2"
  );
});

async function fixtureSession(
  agent: SupportedAgent,
  filename: string
): Promise<LocalSession> {
  const filePath = path.join(FIXTURES, filename);
  const { size, mtime } = await import("node:fs/promises").then(({ stat }) =>
    stat(filePath)
  );
  return {
    id: `${agent}-fixture`,
    agent,
    path: filePath,
    modifiedAt: mtime.toISOString(),
    bytes: size,
    workspaceMatch: true,
  };
}

test("parses the versioned Cursor JSONL fixture", async () => {
  const loaded = await loadLocalSession(
    await fixtureSession("cursor", "cursor-v1.jsonl")
  );
  assert.equal(loaded.formatVersion, "cursor-jsonl-v1");
  assert.equal(loaded.events.length, 4);
  assert.equal(loaded.events[0].role, "user");
  assert.equal(loaded.events[2].name, "tool_call:ReadFile");
});

test("parses Claude Code text, tool calls, and tool results", async () => {
  const loaded = await loadLocalSession(
    await fixtureSession("claude-code", "claude-code-v1.jsonl")
  );
  assert.equal(loaded.formatVersion, "claude-code-jsonl-v1");
  assert.equal(loaded.events.length, 4);
  assert.equal(loaded.events[2].name, "tool_call:Bash");
  assert.equal(loaded.events[3].role, "tool");
  assert.equal(loaded.events[3].content, "1 test passed");
});

test("hydrates only session-scoped persisted Claude tool output", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "contextproof-claude-"));
  const sessionId = "claude-persisted";
  const toolDirectory = path.join(directory, sessionId, "tool-results");
  const outputPath = path.join(toolDirectory, "result.txt");
  const sessionPath = path.join(directory, `${sessionId}.jsonl`);
  await mkdir(toolDirectory, { recursive: true });
  await writeFile(outputPath, "complete persisted tool output");
  const source = `${JSON.stringify({
    type: "user",
    uuid: "result-record",
    message: {
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: "tool-persisted",
          content: "truncated",
        },
      ],
    },
    toolUseResult: { persistedOutputPath: outputPath },
  })}\n`;
  await writeFile(sessionPath, source);

  const loaded = await loadLocalSession({
    id: sessionId,
    agent: "claude-code",
    path: sessionPath,
    modifiedAt: new Date(0).toISOString(),
    bytes: Buffer.byteLength(source),
    workspaceMatch: true,
  });
  assert.equal(loaded.events[0].content, "complete persisted tool output");
  assert.equal(
    loaded.events[0].metadata?.hydratedFromPersistedOutput,
    true
  );
  await rm(directory, { recursive: true, force: true });
});

test("parses Codex response items", async () => {
  const loaded = await loadLocalSession(
    await fixtureSession("codex", "codex-v1.jsonl")
  );
  assert.equal(loaded.formatVersion, "codex-jsonl-v1");
  assert.equal(loaded.events.length, 4);
  assert.equal(loaded.events[1].name, "tool_call:shell");
  assert.equal(loaded.events[2].role, "tool");
});

test("fails safely on format drift without changing the source", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "contextproof-drift-"));
  const filePath = path.join(directory, "unknown.jsonl");
  const original = '{"unexpected":"future-format"}\n';
  await writeFile(filePath, original);
  const session: LocalSession = {
    id: "unknown",
    agent: "cursor",
    path: filePath,
    modifiedAt: new Date(0).toISOString(),
    bytes: Buffer.byteLength(original),
    workspaceMatch: true,
  };

  await assert.rejects(
    loadLocalSession(session),
    /Unsupported cursor session format/
  );
  assert.equal(await readFile(filePath, "utf8"), original);
  await rm(directory, { recursive: true, force: true });
});

test("local reports omit raw content and redact likely secrets", async () => {
  const loaded = await loadLocalSession(
    await fixtureSession("cursor", "cursor-v1.jsonl")
  );
  const inspection = inspectContext(loaded.events, { agent: "cursor" });
  const recommendations = recommendPolicies(inspection, loaded.events);
  const directory = await mkdtemp(path.join(tmpdir(), "contextproof-report-"));
  const reportPath = await writeLocalReport(
    loaded,
    inspection,
    recommendations,
    directory
  );
  const report = await readFile(reportPath, "utf8");

  assert.doesNotMatch(report, /fixture-secret-must-not-render/);
  assert.doesNotMatch(report, /Fix the failing parser test/);
  assert.equal(
    redactSecrets("api_key=fixture-secret-must-not-render"),
    "api_key=[REDACTED]"
  );
  assert.match(report, /No trace content was uploaded/);
  await rm(directory, { recursive: true, force: true });
});

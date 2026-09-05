import { readFile, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { parseTraceText } from "./normalize";
import type { AgentKind, TraceEvent } from "./types";

export type SupportedAgent = "cursor" | "claude-code" | "codex";

export interface LocalSession {
  id: string;
  agent: SupportedAgent;
  path: string;
  modifiedAt: string;
  bytes: number;
  workspaceMatch: boolean;
}

export interface LoadedLocalSession {
  session: LocalSession;
  events: TraceEvent[];
  formatVersion: string;
  skippedRecords: number;
}

const MAX_SESSION_BYTES = 25 * 1024 * 1024;
const MAX_HYDRATED_TOOL_BYTES = 10 * 1024 * 1024;

export function workspaceSlug(
  workspace: string,
  leadingSlash: boolean
): string {
  const input = leadingSlash ? workspace : workspace.replace(/^[/\\]+/, "");
  return input.replace(/[^A-Za-z0-9-]+/g, "-");
}

async function collectJsonlFiles(
  root: string,
  options: { excludeSubagents?: boolean } = {}
): Promise<string[]> {
  const output: string[] = [];
  async function walk(directory: string) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT" || code === "EACCES") return;
      throw error;
    }
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (options.excludeSubagents && entry.name === "subagents") continue;
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        output.push(fullPath);
      }
    }
  }
  await walk(root);
  return output;
}

async function sessionFromPath(
  filePath: string,
  agent: SupportedAgent,
  workspace: string,
  workspaceMatch = true
): Promise<LocalSession> {
  const metadata = await stat(filePath);
  return {
    id: path.basename(filePath, ".jsonl").replace(/^rollout-/, ""),
    agent,
    path: filePath,
    modifiedAt: metadata.mtime.toISOString(),
    bytes: metadata.size,
    workspaceMatch,
  };
}

async function codexWorkspaceMatch(
  filePath: string,
  workspace: string
): Promise<boolean> {
  const handle = await import("node:fs/promises").then(({ open }) =>
    open(filePath, "r")
  );
  try {
    const buffer = Buffer.alloc(64 * 1024);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const start = buffer.subarray(0, bytesRead).toString("utf8");
    return start.includes(workspace) || start.includes(JSON.stringify(workspace));
  } finally {
    await handle.close();
  }
}

export async function discoverLocalSessions(
  agent: SupportedAgent,
  workspace = process.cwd()
): Promise<LocalSession[]> {
  let paths: string[] = [];
  const home = homedir();

  if (agent === "cursor") {
    const root = path.join(
      home,
      ".cursor",
      "projects",
      workspaceSlug(workspace, false),
      "agent-transcripts"
    );
    paths = await collectJsonlFiles(root, { excludeSubagents: true });
  } else if (agent === "claude-code") {
    const configuredRoots = [
      process.env.CLAUDE_CONFIG_DIR,
      ...(process.env.CLAUDE_CONFIG_DIRS?.split(path.delimiter) ?? []),
    ].filter((value): value is string => Boolean(value));
    const roots =
      configuredRoots.length > 0
        ? configuredRoots
        : [path.join(home, ".claude")];
    const discovered = await Promise.all(
      roots.map((root) =>
        collectJsonlFiles(
          path.join(root, "projects", workspaceSlug(workspace, true)),
          { excludeSubagents: true }
        )
      )
    );
    paths = [...new Set(discovered.flat())];
  } else {
    const codexHome = process.env.CODEX_HOME ?? path.join(home, ".codex");
    const candidates = await collectJsonlFiles(
      path.join(codexHome, "sessions"),
      { excludeSubagents: true }
    );
    const matches = await Promise.all(
      candidates.map(async (candidate) => ({
        candidate,
        matches: await codexWorkspaceMatch(candidate, workspace),
      }))
    );
    paths = matches
      .filter((item) => item.matches)
      .map((item) => item.candidate);
  }

  const sessions = await Promise.all(
    paths.map(async (filePath) =>
      sessionFromPath(
        filePath,
        agent,
        workspace,
        agent === "codex"
          ? await codexWorkspaceMatch(filePath, workspace)
          : true
      )
    )
  );
  return sessions.sort(
    (a, b) =>
      new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
  );
}

function stringifyContent(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((part) => {
        if (typeof part === "string") return part;
        if (!part || typeof part !== "object") return String(part ?? "");
        const item = part as Record<string, unknown>;
        return stringifyContent(
          item.text ?? item.content ?? item.output ?? item.input ?? item
        );
      })
      .filter(Boolean)
      .join("\n");
  }
  if (value == null) return "";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function roleOf(value: unknown): TraceEvent["role"] {
  const role = String(value ?? "unknown").toLowerCase();
  if (["system", "developer", "user", "assistant", "tool"].includes(role)) {
    return role as TraceEvent["role"];
  }
  return "unknown";
}

function blockEvents(
  blocks: unknown,
  fallbackRole: TraceEvent["role"],
  baseId: string,
  timestamp?: string
): TraceEvent[] {
  if (!Array.isArray(blocks)) {
    const content = stringifyContent(blocks);
    return content
      ? [{ id: baseId, role: fallbackRole, content, timestamp }]
      : [];
  }

  return blocks.flatMap((block, index): TraceEvent[] => {
    const item = asRecord(block);
    if (!item) {
      const content = stringifyContent(block);
      return content
        ? [{ id: `${baseId}-${index}`, role: fallbackRole, content, timestamp }]
        : [];
    }
    const type = String(item.type ?? "text");
    if (["thinking", "reasoning", "redacted_thinking"].includes(type)) return [];
    if (["tool_use", "function_call", "custom_tool_call"].includes(type)) {
      return [
        {
          id: String(item.id ?? `${baseId}-call-${index}`),
          role: "assistant",
          name: `tool_call:${String(item.name ?? item.call_id ?? "unknown")}`,
          content: stringifyContent(item.input ?? item.arguments ?? item),
          timestamp,
          metadata: { sourceBlockType: type },
        },
      ];
    }
    if (
      ["tool_result", "function_call_output", "custom_tool_call_output"].includes(
        type
      )
    ) {
      return [
        {
          id: String(item.tool_use_id ?? item.call_id ?? `${baseId}-result-${index}`),
          role: "tool",
          name: String(item.name ?? item.tool_name ?? "tool_result"),
          content: stringifyContent(item.content ?? item.output ?? item),
          timestamp,
          metadata: { sourceBlockType: type, isError: item.is_error === true },
        },
      ];
    }
    const content = stringifyContent(
      item.text ?? item.content ?? item.output ?? item
    );
    return content
      ? [
          {
            id: String(item.id ?? `${baseId}-${index}`),
            role: fallbackRole,
            content,
            timestamp,
            metadata: { sourceBlockType: type },
          },
        ]
      : [];
  });
}

function normalizeCursor(records: unknown[]): TraceEvent[] {
  return records.flatMap((record, index) => {
    const item = asRecord(record);
    const message = asRecord(item?.message);
    if (!item || !message) return [];
    const role = roleOf(message.role ?? item.role);
    return blockEvents(
      message.content,
      role,
      String(message.id ?? item.uuid ?? `cursor-${index}`),
      typeof item.timestamp === "string" ? item.timestamp : undefined
    );
  });
}

function normalizeClaude(records: unknown[]): TraceEvent[] {
  return records.flatMap((record, index) => {
    const item = asRecord(record);
    const message = asRecord(item?.message);
    if (!item || !message) return [];
    const role = roleOf(message.role);
    return blockEvents(
      message.content,
      role,
      String(message.id ?? item.uuid ?? `claude-${index}`),
      typeof item.timestamp === "string" ? item.timestamp : undefined
    );
  });
}

async function hydrateClaudeToolResults(
  records: unknown[],
  events: TraceEvent[],
  session: LocalSession
): Promise<void> {
  const allowedRoot = path.resolve(
    path.dirname(session.path),
    session.id,
    "tool-results"
  );
  const eventsById = new Map(events.map((event) => [event.id, event]));
  let hydratedBytes = 0;

  for (const record of records) {
    const item = asRecord(record);
    const toolUseResult = asRecord(item?.toolUseResult);
    const persistedPath = toolUseResult?.persistedOutputPath;
    if (typeof persistedPath !== "string") continue;

    const resolvedPath = path.resolve(persistedPath);
    if (
      resolvedPath !== allowedRoot &&
      !resolvedPath.startsWith(`${allowedRoot}${path.sep}`)
    ) {
      continue;
    }

    let fileSize: number;
    try {
      fileSize = (await stat(resolvedPath)).size;
    } catch {
      continue;
    }
    if (
      fileSize <= 0 ||
      hydratedBytes + fileSize > MAX_HYDRATED_TOOL_BYTES
    ) {
      continue;
    }

    const message = asRecord(item?.message);
    const blocks = Array.isArray(message?.content) ? message.content : [];
    const resultBlock = blocks
      .map(asRecord)
      .find((block) => block?.type === "tool_result");
    const toolUseId = resultBlock?.tool_use_id;
    if (typeof toolUseId !== "string") continue;
    const event = eventsById.get(toolUseId);
    if (!event || event.role !== "tool") continue;

    event.content = await readFile(resolvedPath, "utf8");
    event.metadata = {
      ...event.metadata,
      hydratedFromPersistedOutput: true,
      persistedOutputBytes: fileSize,
    };
    hydratedBytes += fileSize;
  }
}

function normalizeCodex(records: unknown[]): TraceEvent[] {
  return records.flatMap((record, index) => {
    const item = asRecord(record);
    if (!item) return [];
    const payload = asRecord(item.payload) ?? item;
    const recordType = String(item.type ?? payload.type ?? "");
    const payloadType = String(payload.type ?? "");
    const timestamp =
      typeof item.timestamp === "string" ? item.timestamp : undefined;
    const baseId = String(payload.id ?? payload.call_id ?? `codex-${index}`);

    if (
      recordType === "response_item" ||
      ["message", "function_call", "function_call_output"].includes(payloadType)
    ) {
      if (payloadType === "function_call") {
        return blockEvents([payload], "assistant", baseId, timestamp);
      }
      if (payloadType === "function_call_output") {
        return blockEvents([payload], "tool", baseId, timestamp);
      }
      return blockEvents(
        payload.content,
        roleOf(payload.role),
        baseId,
        timestamp
      );
    }
    if (recordType === "event_msg") {
      const eventType = String(payload.type ?? "");
      const role: TraceEvent["role"] =
        eventType === "user_message" ? "user" : "assistant";
      const content = stringifyContent(
        payload.message ?? payload.text ?? payload.content
      );
      return content ? [{ id: baseId, role, content, timestamp }] : [];
    }
    return [];
  });
}

export async function loadLocalSession(
  session: LocalSession
): Promise<LoadedLocalSession> {
  if (session.bytes > MAX_SESSION_BYTES) {
    throw new Error(
      `Session ${session.id} exceeds the 25 MiB local safety limit.`
    );
  }
  const text = await readFile(session.path, "utf8");
  const parsed = parseTraceText(text);
  const records = Array.isArray(parsed) ? parsed : [parsed];
  const events =
    session.agent === "cursor"
      ? normalizeCursor(records)
      : session.agent === "claude-code"
        ? normalizeClaude(records)
        : normalizeCodex(records);
  if (session.agent === "claude-code") {
    await hydrateClaudeToolResults(records, events, session);
  }

  if (events.length === 0) {
    throw new Error(
      `Unsupported ${session.agent} session format in ${session.id}. ` +
        "No recognized message or tool records were found; the source file was not modified."
    );
  }

  return {
    session,
    events,
    formatVersion: `${session.agent}-jsonl-v1`,
    skippedRecords: Math.max(0, records.length - events.length),
  };
}

export async function selectLocalSession(
  agent: SupportedAgent,
  selector: "latest" | string,
  workspace = process.cwd()
): Promise<LocalSession> {
  const sessions = await discoverLocalSessions(agent, workspace);
  if (sessions.length === 0) {
    throw new Error(
      `No ${agent} sessions found for ${workspace}. ` +
        `Expected local history under the standard ${agent} data directory.`
    );
  }
  if (selector === "latest") return sessions[0];
  const exact = sessions.find(
    (session) =>
      session.id === selector ||
      path.basename(session.path) === selector ||
      session.path === selector
  );
  if (!exact) {
    throw new Error(
      `Session ${selector} was not found. Run "contextproof inspect ${agent} --list".`
    );
  }
  return exact;
}

export function agentKind(agent: SupportedAgent): AgentKind {
  return agent;
}

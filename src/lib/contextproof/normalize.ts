import type { AgentKind, TraceEvent } from "./types";

const ROLES = new Set(["system", "developer", "user", "assistant", "tool"]);

function contentToString(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text?: unknown }).text ?? "");
        }
        return JSON.stringify(part);
      })
      .join("\n");
  }
  if (content == null) return "";
  return typeof content === "object" ? JSON.stringify(content) : String(content);
}

export function normalizeTrace(input: unknown): TraceEvent[] {
  let records: unknown[] = [];

  if (Array.isArray(input)) {
    records = input;
  } else if (input && typeof input === "object") {
    const object = input as Record<string, unknown>;
    const candidate = object.events ?? object.messages ?? object.trace ?? object.items;
    records = Array.isArray(candidate) ? candidate : [input];
  } else {
    throw new Error("Trace must be a JSON array or object.");
  }

  return records
    .map((record, index): TraceEvent | null => {
      if (!record || typeof record !== "object") return null;
      const item = record as Record<string, unknown>;
      const rawRole = String(item.role ?? item.type ?? "unknown").toLowerCase();
      const role = ROLES.has(rawRole)
        ? (rawRole as TraceEvent["role"])
        : rawRole.includes("tool")
          ? "tool"
          : "unknown";
      const content = contentToString(
        item.content ?? item.text ?? item.output ?? item.result ?? item.message
      );
      if (!content) return null;

      return {
        id: String(item.id ?? item.uuid ?? `event-${index + 1}`),
        role,
        name:
          typeof item.name === "string"
            ? item.name
            : typeof item.tool_name === "string"
              ? item.tool_name
              : undefined,
        content,
        timestamp:
          typeof item.timestamp === "string"
            ? item.timestamp
            : typeof item.created_at === "string"
              ? item.created_at
              : undefined,
        metadata:
          item.metadata && typeof item.metadata === "object"
            ? (item.metadata as Record<string, unknown>)
            : undefined,
      };
    })
    .filter((event): event is TraceEvent => event !== null);
}

export function detectAgent(input: unknown): AgentKind {
  const serialized = JSON.stringify(input).toLowerCase();
  if (serialized.includes("claude") || serialized.includes("anthropic")) {
    return "claude-code";
  }
  if (serialized.includes("cursor")) return "cursor";
  if (serialized.includes("codex") || serialized.includes("openai")) return "codex";
  return "generic";
}

export function parseTraceText(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Trace input is empty.");

  try {
    return JSON.parse(trimmed);
  } catch {
    const rows = trimmed
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line, index) => {
        try {
          return JSON.parse(line);
        } catch {
          throw new Error(`Invalid JSONL at line ${index + 1}.`);
        }
      });
    return rows;
  }
}

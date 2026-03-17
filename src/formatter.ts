import { createHash } from "node:crypto";
import type { HookInput } from "./types.js";

const MAX_PREVIEW = 500;

function redactSecrets(text: string): string {
  return text
    .replace(/(cc_(?:live|test)_[a-zA-Z0-9_-]{8,})/g, "[REDACTED_API_KEY]")
    .replace(/(whsec_[a-zA-Z0-9_-]{8,})/g, "[REDACTED_WEBHOOK_SECRET]")
    .replace(/(Bearer\s+)[^\s]+/gi, "$1[REDACTED_TOKEN]")
    .replace(/("?(?:api[_-]?key|token|secret|password)"?\s*:\s*)"[^"]*"/gi, '$1"[REDACTED]"')
    .replace(/((?:api[_-]?key|token|secret|password)\s*=\s*)[^\s]+/gi, "$1[REDACTED]");
}

function clip(text: string, size = MAX_PREVIEW): string {
  if (text.length <= size) return text;
  return `${text.slice(0, size)}... [truncated]`;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

export function buildIdempotencyKey(input: HookInput): string {
  const raw = `${input.session_id}|${input.tool_name}|${stableStringify(input.tool_input)}`;
  const hash = createHash("sha256").update(raw).digest("hex").slice(0, 24);
  return `claude:${input.session_id}:${input.tool_name}:${hash}`;
}

export function formatRequest(input: HookInput): {
  question: string;
  context: string;
  metadata: Record<string, unknown>;
} {
  const tool = input.tool_name;
  const toolInput = input.tool_input ?? {};
  const safeJson = redactSecrets(stableStringify(toolInput));

  let question = `Approve ${tool}?`;
  let context = `Tool input:\n${safeJson}`;

  if (tool === "Write" || tool === "Edit") {
    const path = typeof toolInput.file_path === "string" ? toolInput.file_path : "unknown file";
    const contentRaw =
      typeof toolInput.content === "string"
        ? toolInput.content
        : typeof toolInput.new_string === "string"
          ? toolInput.new_string
          : safeJson;
    question = `Approve ${tool} to ${path}?`;
    context = `Preview:\n${clip(redactSecrets(contentRaw))}`;
  } else if (tool === "Bash" || tool === "Shell") {
    const command =
      typeof toolInput.command === "string" ? toolInput.command : clip(safeJson, MAX_PREVIEW);
    question = `Approve command: ${redactSecrets(command)}?`;
    context = `Command detail:\n${redactSecrets(command)}`;
  }

  return {
    question,
    context,
    metadata: {
      source: "claude-code",
      session_id: input.session_id,
      tool_name: tool,
      tool_input_hash: createHash("sha256").update(stableStringify(toolInput)).digest("hex").slice(0, 24),
      cwd: input.cwd ?? "",
    },
  };
}

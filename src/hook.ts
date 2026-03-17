#!/usr/bin/env node
import { stdin, stdout, stderr } from "node:process";
import { CentcomClient } from "./centcomClient.js";
import { loadConfig } from "./config.js";
import { buildIdempotencyKey, formatRequest } from "./formatter.js";
import type { HookInput, HookOutput, PermissionDecision } from "./types.js";

let activeRequestId: string | null = null;
let activeClient: CentcomClient | null = null;
let fallbackDecision: PermissionDecision = "deny";

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    stdin.setEncoding("utf8");
    stdin.on("data", (chunk) => {
      data += chunk;
    });
    stdin.on("end", () => resolve(data));
    stdin.on("error", reject);
  });
}

function writeDecision(
  permissionDecision: PermissionDecision,
  systemMessage?: string,
): never {
  const output: HookOutput = {
    hookSpecificOutput: { permissionDecision },
    ...(systemMessage ? { systemMessage } : {}),
  };
  stdout.write(JSON.stringify(output));
  process.exit(0);
}

async function safeCancel(): Promise<void> {
  if (!activeClient || !activeRequestId) return;
  try {
    await activeClient.cancelRequest(activeRequestId);
  } catch {
    // Best-effort cleanup only.
  }
}

function registerSignalHandlers(): void {
  const handler = async () => {
    await safeCancel();
    writeDecision(fallbackDecision, "Approval interrupted before decision.");
  };
  process.on("SIGINT", handler);
  process.on("SIGTERM", handler);
}

function parseInput(raw: string): HookInput {
  if (!raw.trim()) {
    throw new Error("Hook input is empty");
  }
  return JSON.parse(raw) as HookInput;
}

function responseApproved(response: Record<string, unknown> | null | undefined): boolean {
  if (!response || typeof response !== "object") return false;
  if (typeof response.approved === "boolean") return response.approved;
  if (typeof response.value === "boolean") return response.value;
  return false;
}

async function main(): Promise<void> {
  const config = loadConfig();
  fallbackDecision = config.fallback;
  registerSignalHandlers();

  const raw = await readStdin();
  const input = parseInput(raw);

  if (!config.tools.has(input.tool_name)) {
    writeDecision("allow");
  }

  const client = new CentcomClient({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    timeoutMs: Math.min(config.timeoutMs, 30_000),
  });
  activeClient = client;

  const formatted = formatRequest(input);
  const idempotencyKey = buildIdempotencyKey(input);

  try {
    const request = await client.createRequest({
      type: "approval",
      question: formatted.question,
      context: formatted.context,
      callback_url: config.callbackUrl,
      priority: config.priority,
      required_role: config.requiredRole,
      metadata: formatted.metadata,
      sla_minutes: config.slaMinutes,
      idempotency_key: idempotencyKey,
    });

    activeRequestId = request.id;

    const result = await client.waitForResponse(
      request.id,
      config.pollIntervalMs,
      config.timeoutMs,
    );

    const approved = responseApproved((result.response as Record<string, unknown>) ?? null);
    writeDecision(approved ? "allow" : "deny");
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.toLowerCase().includes("timeout") &&
      activeRequestId
    ) {
      await safeCancel();
      writeDecision("deny", "Approval timed out and was denied.");
    }

    const message = error instanceof Error ? error.message : "Unknown approval error";
    stderr.write(`centcom-claude-code: ${message}\n`);
    writeDecision(config.fallback, `CENTCOM unavailable, fallback=${config.fallback}.`);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unhandled error";
  stderr.write(`centcom-claude-code: ${message}\n`);
  writeDecision(fallbackDecision, `CENTCOM hook failed, fallback=${fallbackDecision}.`);
});

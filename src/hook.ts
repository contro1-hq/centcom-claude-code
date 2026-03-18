#!/usr/bin/env node
import { writeSync } from "node:fs";
import { stdin, stderr } from "node:process";
import { CentcomClient } from "@contro1/sdk";
import { loadConfig } from "./config.js";
import { buildIdempotencyKey, formatRequest } from "./formatter.js";
import type { HookInput, HookBehavior } from "./types.js";

let activeRequestId: string | null = null;
let activeClient: CentcomClient | null = null;
let fallbackDecision: HookBehavior = "deny";
let decided = false;

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
  behavior: HookBehavior,
  systemMessage?: string,
): void {
  if (decided) return;
  decided = true;
  const output = {
    hookSpecificOutput: {
      hookEventName: "PermissionRequest",
      decision: {
        behavior,
        ...(behavior === "deny" && systemMessage ? { message: systemMessage } : {}),
      },
    },
  };
  const json = JSON.stringify(output);
  try {
    writeSync(1, json);
  } catch {
    process.stdout.write(json);
  }
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
  const handler = () => {
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
    return;
  }

  const client = new CentcomClient({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    timeout: Math.min(config.timeoutMs, 30_000),
  });
  activeClient = client;

  const formatted = formatRequest(input);
  const idempotencyKey = buildIdempotencyKey(input);

  try {
    const requestPayload: Record<string, unknown> = {
      type: "approval",
      question: formatted.question,
      context: formatted.context,
      priority: config.priority,
      required_role: config.requiredRole,
      metadata: {
        ...formatted.metadata,
        idempotency_key: idempotencyKey,
      },
      sla_minutes: config.slaMinutes,
      idempotency_key: idempotencyKey,
    };
    if (config.callbackUrl) {
      requestPayload.callback_url = config.callbackUrl;
    }

    const request = await client.createRequest(requestPayload as any);
    activeRequestId = request.id;

    const result = await client.waitForResponse(
      request.id,
      config.pollIntervalMs,
      config.timeoutMs,
    );

    const approved = responseApproved((result.response as Record<string, unknown>) ?? null);
    writeDecision(approved ? "allow" : "deny");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown approval error";
    if (
      error instanceof Error &&
      error.message.toLowerCase().includes("timeout") &&
      activeRequestId
    ) {
      await safeCancel();
      writeDecision("deny", "Approval timed out and was denied.");
      return;
    }

    stderr.write(`centcom-claude-code: ${message}\n`);
    writeDecision(config.fallback, `CENTCOM unavailable, fallback=${config.fallback}.`);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unhandled error";
  stderr.write(`centcom-claude-code: ${message}\n`);
  writeDecision(fallbackDecision, `CENTCOM hook failed, fallback=${fallbackDecision}.`);
});

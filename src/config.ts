import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { CentcomClaudeConfig, PermissionDecision } from "./types.js";

interface FileConfig {
  CENTCOM_API_KEY?: string;
  CENTCOM_BASE_URL?: string;
  CENTCOM_TOOLS?: string;
  CENTCOM_TIMEOUT?: number;
  CENTCOM_POLL_INTERVAL?: number;
  CENTCOM_PRIORITY?: "normal" | "urgent";
  CENTCOM_SLA_MINUTES?: number;
  CENTCOM_FALLBACK?: PermissionDecision;
  CENTCOM_REQUIRED_ROLE?: string;
  CENTCOM_CALLBACK_URL?: string;
}

const DEFAULT_BASE_URL = "https://contro1.com/api/centcom/v1";
const DEFAULT_TOOLS = "Write,Edit,Bash";
const DEFAULT_TIMEOUT_MS = 300_000;
const DEFAULT_POLL_INTERVAL_MS = 3_000;
const DEFAULT_PRIORITY: "normal" | "urgent" = "urgent";
const DEFAULT_FALLBACK: PermissionDecision = "deny";
const DEFAULT_CALLBACK_URL = "https://centcom.local/claude-code";

function readLocalConfig(): FileConfig {
  const path = join(process.cwd(), ".centcom.json");
  if (!existsSync(path)) return {};
  try {
    const raw = readFileSync(path, "utf-8");
    return JSON.parse(raw) as FileConfig;
  } catch {
    return {};
  }
}

function parseTools(value?: string): Set<string> {
  return new Set(
    (value ?? DEFAULT_TOOLS)
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean),
  );
}

export function loadConfig(): CentcomClaudeConfig {
  const file = readLocalConfig();
  const env = process.env;

  const apiKey = env.CENTCOM_API_KEY ?? file.CENTCOM_API_KEY;
  if (!apiKey) {
    throw new Error("CENTCOM_API_KEY is required");
  }

  const baseUrl = env.CENTCOM_BASE_URL ?? file.CENTCOM_BASE_URL ?? DEFAULT_BASE_URL;
  const tools = parseTools(env.CENTCOM_TOOLS ?? file.CENTCOM_TOOLS);
  const timeoutMs = Number(env.CENTCOM_TIMEOUT ?? file.CENTCOM_TIMEOUT ?? DEFAULT_TIMEOUT_MS);
  const pollIntervalMs = Number(
    env.CENTCOM_POLL_INTERVAL ?? file.CENTCOM_POLL_INTERVAL ?? DEFAULT_POLL_INTERVAL_MS,
  );

  const priorityRaw = env.CENTCOM_PRIORITY ?? file.CENTCOM_PRIORITY ?? DEFAULT_PRIORITY;
  const priority = priorityRaw === "normal" ? "normal" : "urgent";

  const fallbackRaw = (env.CENTCOM_FALLBACK ?? file.CENTCOM_FALLBACK ?? DEFAULT_FALLBACK) as PermissionDecision;
  const fallback: PermissionDecision = fallbackRaw === "ask" || fallbackRaw === "allow" ? fallbackRaw : "deny";

  const slaValue = env.CENTCOM_SLA_MINUTES ?? file.CENTCOM_SLA_MINUTES;
  const slaMinutes = slaValue !== undefined ? Number(slaValue) : undefined;
  const requiredRole = env.CENTCOM_REQUIRED_ROLE ?? file.CENTCOM_REQUIRED_ROLE;
  const callbackUrl = env.CENTCOM_CALLBACK_URL ?? file.CENTCOM_CALLBACK_URL ?? DEFAULT_CALLBACK_URL;

  return {
    apiKey,
    baseUrl,
    tools,
    timeoutMs,
    pollIntervalMs,
    priority,
    slaMinutes: Number.isFinite(slaMinutes as number) ? slaMinutes : undefined,
    requiredRole: requiredRole || undefined,
    fallback,
    callbackUrl,
  };
}

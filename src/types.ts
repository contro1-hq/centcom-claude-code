export type PermissionDecision = "allow" | "deny" | "ask";

export interface HookInput {
  session_id: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  cwd?: string;
  permission_mode?: string;
  hook_event_name?: string;
}

export interface HookOutput {
  hookSpecificOutput: {
    permissionDecision: PermissionDecision;
  };
  systemMessage?: string;
}

export interface CentcomClaudeConfig {
  apiKey: string;
  baseUrl: string;
  tools: Set<string>;
  timeoutMs: number;
  pollIntervalMs: number;
  priority: "normal" | "urgent";
  slaMinutes?: number;
  requiredRole?: string;
  fallback: PermissionDecision;
  callbackUrl?: string;
}

export type HookBehavior = "allow" | "deny";

export interface HookInput {
  session_id: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  cwd?: string;
  permission_mode?: string;
  hook_event_name?: string;
  transcript_path?: string;
}

export interface HookOutput {
  hookSpecificOutput: {
    hookEventName: "PermissionRequest";
    decision: {
      behavior: HookBehavior;
      message?: string;
    };
  };
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
  fallback: HookBehavior;
  callbackUrl?: string;
}

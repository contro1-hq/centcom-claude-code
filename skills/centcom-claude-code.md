---
name: centcom-claude-code
description: Guide for integrating CENTCOM approvals into Claude Code PermissionRequest hooks with secure defaults.
user_invocable: true
---

# CENTCOM + Claude Code Connector Guide

You are helping a developer integrate `@contro1/claude-code` so Claude tool calls are approved by CENTCOM operators.

## Step 1: Confirm Runtime and Policy

Before editing files, confirm with the user:
- Which tools require approvals (`Write`, `Edit`, `Bash`, or custom set)
- Fallback policy on outages/timeouts (`deny` recommended for risky tools)
- Whether they already have a CENTCOM API key (`cc_live_...`) or need to generate one

If unclear, default to deny-by-default for risky tools and `Write|Edit|Bash` matcher.

## Step 2: Install Connector

```bash
npm install -g @contro1/claude-code
```

Verify installation:
```bash
centcom-claude-code --version
```

macOS note:
- The public connector works on macOS as long as `node >= 18` is installed and the global npm bin is on `PATH`.
- Settings path is the same: `~/.claude/settings.json`.

## Step 3: Configure Environment Variables

IMPORTANT: Store secrets in the **user-level** Claude settings file (`~/.claude/settings.json`), NOT in the project `.claude/settings.json` — to avoid committing keys to git.

Add an `env` block to `~/.claude/settings.json`:

```json
{
  "env": {
    "CENTCOM_API_KEY": "cc_live_xxx",
    "CENTCOM_BASE_URL": "https://api.contro1.com/api/centcom/v1",
    "CENTCOM_FALLBACK": "deny",
    "CENTCOM_TOOLS": "Write,Edit,Bash",
    "CENTCOM_TIMEOUT": "300000",
    "CENTCOM_POLL_INTERVAL": "3000"
  }
}
```

Ask the user to replace `cc_live_xxx` with their actual API key. They can generate one in the CENTCOM dashboard under Settings > API Keys.

`CENTCOM_BASE_URL` is REQUIRED — do not skip it.

Optional variables:
- `CENTCOM_REQUIRED_ROLE` — require specific operator role
- `CENTCOM_SLA_MINUTES` — expected response time
- `CENTCOM_CALLBACK_URL` — only if webhook callbacks are desired

Never commit API keys to repository files.

## Step 4: Add Claude Hook

Update the **project-level** `.claude/settings.json` with the PermissionRequest hook.

IMPORTANT: The hook schema requires a nested `hooks` array inside each matcher entry:

```json
{
  "hooks": {
    "PermissionRequest": [
      {
        "matcher": "Write|Edit|Bash",
        "hooks": [
          {
            "type": "command",
            "command": "centcom-claude-code",
            "timeout": 310
          }
        ]
      }
    ]
  }
}
```

Note: `timeout` is in **seconds** (not milliseconds). 310s gives a buffer above the 300s CENTCOM polling timeout.

## Step 5: Validate Connection

Test the connector end-to-end by piping a simulated tool call:

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"echo hello"}}' | centcom-claude-code
```

Expected response format:
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PermissionRequest",
    "decision": {
      "behavior": "allow"
    }
  }
}
```

- `"behavior": "allow"` — operator approved (or tool not in CENTCOM_TOOLS)
- `"behavior": "deny"` — operator denied, timed out, or fallback applied

If you see HTML in the error or "unexpected token" errors, the `CENTCOM_BASE_URL` is wrong or missing.

Mini example (manager-only approvals for risky tools):
```json
{
  "env": {
    "CENTCOM_REQUIRED_ROLE": "manager",
    "CENTCOM_TOOLS": "Write,Edit,Bash",
    "CENTCOM_FALLBACK": "deny"
  }
}
```

## Step 6: Apply Security Hardening

- Keep fallback as `deny` for risky tools.
- Ensure redaction is enabled before sending tool input/context.
- Use idempotency to avoid duplicate approval requests on retries.
- Do not print raw secrets in logs or system messages.

## Architecture Note

The Claude Code connector uses **polling** (`waitForResponse`) because hooks are blocking stdin→stdout processes. Other CENTCOM integrations (Slack notifications, dashboard, LangGraph) use **webhooks** by default to minimize server load.

## Common Patterns

### Strict Production Policy
- `CENTCOM_FALLBACK=deny`
- approvals on `Write|Edit|Bash`
- short audit-friendly metadata per request

### Developer-Friendly Setup
- same tool matcher
- lower `CENTCOM_TIMEOUT` for faster feedback
- use test API key and isolated workspace

## Related Skills

- Python SDK skill:
  `https://github.com/contro1-hq/centcom/blob/main/skills/centcom-python-sdk.md`
- JS SDK skill:
  `https://github.com/contro1-hq/centcom-sdk/blob/main/skills/centcom-js-sdk.md`
- LangGraph skill:
  `https://github.com/contro1-hq/centcom-langgraph/blob/main/skills/centcom-langgraph.md`

---
name: centcom-claude-code
description: Guide for integrating CENTCOM approvals into Claude Code PreToolUse hooks with secure defaults.
user_invocable: true
---

# CENTCOM + Claude Code Connector Guide

You are helping a developer integrate `@contro1/claude-code` so Claude tool calls are approved by CENTCOM operators.

## Step 1: Confirm Runtime and Policy

Before editing files, confirm:
- Which tools require approvals (`Write`, `Edit`, `Bash`, or custom set)
- Fallback policy on outages/timeouts (`deny` recommended for risky tools)
- Whether they need polling-only mode or optional webhook callback

If unclear, default to deny-by-default for risky tools.

## Step 2: Install Connector

```bash
npm install -g @contro1/claude-code
```

## Step 3: Configure Secrets Safely

Set environment variables in a secure local secret store:

```bash
CENTCOM_API_KEY=cc_live_xxx
CENTCOM_FALLBACK=deny
CENTCOM_TOOLS=Write,Edit,Bash
CENTCOM_TIMEOUT=300000
CENTCOM_POLL_INTERVAL=3000
```

Optional:
- `CENTCOM_BASE_URL`
- `CENTCOM_REQUIRED_ROLE`
- `CENTCOM_SLA_MINUTES`
- `CENTCOM_CALLBACK_URL` (only if webhook callbacks are also desired)

Never commit API keys to repository files.

## Step 4: Add Claude Hook

Update `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit|Bash",
        "command": "centcom-claude-code",
        "timeout": 310000
      }
    ]
  }
}
```

## Step 5: Validate Decision Flow

Expected behavior:
- Operator approves -> connector returns `allow`
- Operator rejects -> connector returns `deny`
- Timeout -> request is canceled and connector returns `deny`
- API/transport failure -> fallback decision from `CENTCOM_FALLBACK`

## Step 6: Apply Security Hardening

- Keep fallback as `deny` for risky tools.
- Ensure redaction is enabled before sending tool input/context.
- Use idempotency to avoid duplicate approval requests on retries.
- Do not print raw secrets in logs or system messages.

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

- `centcom-python-sdk` for Python backend integrations
- `centcom-js-sdk` for Node/TypeScript SDK integrations
- `centcom-langgraph` for LangGraph pause/resume flow

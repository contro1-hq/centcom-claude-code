# @contro1/claude-code

Route Claude Code `PermissionRequest` approvals to CENTCOM.

## Agent Integration Kit

To save time, give your coding agent this skill. It inspects your system, reports governance gaps, and suggests Contro1 integration (optional):

```
https://contro1.com/agent-kit
```

The hook reads Claude tool calls from stdin, creates an approval request in CENTCOM, polls for the operator decision, then returns a Claude-compatible permission decision via stdout.

## How It Works

1. Claude Code triggers a `PermissionRequest` hook before executing a tool.
2. The hook sends the tool details to CENTCOM as an approval request.
3. An operator approves or denies in the CENTCOM dashboard (or via Slack).
4. The hook returns the decision to Claude Code, which proceeds or blocks accordingly.

The connector uses **polling** to wait for the operator's decision - this is required because Claude Code hooks are blocking (stdin → stdout). Other CENTCOM integrations (LangGraph, dashboard) use webhooks by default for lower server load.

## Install

```bash
npm install -g @contro1/claude-code
```

## macOS Compatibility

Requirements:
- Node.js 18 or newer
- Global npm bin on your `PATH` (so `centcom-claude-code` is executable)
- Claude user settings at `~/.claude/settings.json`

## Configuration

Set env vars in `~/.claude/settings.json` (user-level, not committed to git):

```json
{
  "env": {
    "CENTCOM_API_KEY": "cc_live_xxx",
    "CENTCOM_BASE_URL": "https://api.contro1.com/api/centcom/v1",
    "CENTCOM_TOOLS": "Write,Edit,Bash",
    "CENTCOM_TIMEOUT": "300000",
    "CENTCOM_POLL_INTERVAL": "3000",
    "CENTCOM_FALLBACK": "deny",
    "CENTCOM_REQUIRED_APPROVALS": "2"
  }
}
```

| Variable | Default | Description |
|---|---|---|
| `CENTCOM_API_KEY` | (required) | API key from CENTCOM dashboard |
| `CENTCOM_BASE_URL` | `https://api.contro1.com/api/centcom/v1` | CENTCOM API endpoint |
| `CENTCOM_TOOLS` | `Write,Edit,Bash` | Comma-separated tools requiring approval |
| `CENTCOM_TIMEOUT` | `300000` | Polling timeout in ms |
| `CENTCOM_POLL_INTERVAL` | `3000` | Poll interval in ms |
| `CENTCOM_PRIORITY` | `urgent` | Request priority (`normal` or `urgent`) |
| `CENTCOM_FALLBACK` | `deny` | Fallback on errors (`deny` or `allow`) |
| `CENTCOM_SLA_MINUTES` | - | Expected response time |
| `CENTCOM_REQUIRED_ROLE` | - | Require specific operator role |
| `CENTCOM_REQUIRED_APPROVALS` | - | Require quorum before Claude Code receives an allow decision |
| `CENTCOM_CALLBACK_URL` | - | Optional webhook callback URL |
| `CENTCOM_CORRELATION_ID` | - | Session or project ID; groups all tool approvals from one Claude Code session into one case timeline |

You can also use a `.centcom.json` file in the working directory with the same keys.

## Claude Code Hook Setup

Add to your **project-level** `.claude/settings.json`:

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

`timeout` is in seconds. 310s gives buffer above the default 300s polling timeout.

## Output Format

The hook writes a JSON response to stdout in Claude Code's expected format:

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

On denial, a `message` field is included in the `decision` object.

## Behavior

- Tools outside `CENTCOM_TOOLS` → auto-allowed (no CENTCOM request)
- Operator approves → `allow`
- Operator denies → `deny`
- Timeout → cancel request + `deny`
- API errors → fallback decision (`CENTCOM_FALLBACK`)
- If `CENTCOM_REQUIRED_APPROVALS` is greater than `1`, Claude Code stays blocked until quorum is met, a reviewer denies, or timeout fails closed.

## Related Packages

- [`centcom`](https://github.com/contro1-hq/centcom) - Python SDK
- [`@contro1/sdk`](https://github.com/contro1-hq/centcom-sdk) - Node/TypeScript SDK
- [`centcom-langgraph`](https://github.com/contro1-hq/centcom-langgraph) - LangGraph integration
- [`contro1-microsoft-agent-governance-toolkit-integration`](https://github.com/contro1-hq/contro1-microsoft-agent-governance-toolkit-integration) - Microsoft AGT policy approval companion

## Skill

This repo includes an integration skill for Claude Code:
- `skills/centcom-claude-code.md`

## Development

```bash
npm install
npm run build
npm pack
```

## Governance readiness

For teams operating AI in regulated environments:
- [EU AI Act readiness guide](https://contro1.com/guides/eu-ai-act-readiness)
- [US AI Governance readiness guide](https://contro1.com/guides/us-ai-governance-readiness)

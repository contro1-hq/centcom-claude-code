# @contro1/claude-code

Route Claude Code `PreToolUse` approvals to CENTCOM.

The hook reads Claude tool calls from stdin, creates an approval request in CENTCOM, polls for the operator decision, then returns a Claude-compatible permission decision.

## Install

```bash
npm install -g @contro1/claude-code
```

## Configuration

Set env vars (or use `.centcom.json` in working directory):

- `CENTCOM_API_KEY` (required)
- `CENTCOM_BASE_URL` (default: `https://contro1.com/api/centcom/v1`)
- `CENTCOM_TOOLS` (default: `Write,Edit,Bash`)
- `CENTCOM_TIMEOUT` (default: `300000` ms)
- `CENTCOM_POLL_INTERVAL` (default: `3000` ms)
- `CENTCOM_PRIORITY` (default: `urgent`)
- `CENTCOM_SLA_MINUTES` (optional)
- `CENTCOM_REQUIRED_ROLE` (optional)
- `CENTCOM_FALLBACK` (`deny` default; supported: `deny`, `ask`, `allow`)
- `CENTCOM_CALLBACK_URL` (optional; only set when you also want webhook callbacks)

## Claude Code Hook Setup

Add this in `.claude/settings.json`:

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

## Behavior

- Tools outside `CENTCOM_TOOLS` are auto-allowed.
- Approved response -> `allow`.
- Rejected response -> `deny`.
- Timeout -> request cancel attempt + `deny`.
- API errors -> fallback decision (`CENTCOM_FALLBACK`).

## Quick Verify

```bash
npm view @contro1/claude-code version
```

## Related Packages

- [`centcom`](https://github.com/contro1-hq/centcom) for Python integrations
- [`@contro1/sdk`](https://github.com/contro1-hq/centcom-sdk) for Node/TypeScript SDK usage
- [`centcom-langgraph`](https://github.com/contro1-hq/centcom-langgraph) for LangGraph integrations

## Development

```bash
npm install
npm run build
npm pack
```

## Skill

This repo includes an integration skill:
- `skills/centcom-claude-code.md`

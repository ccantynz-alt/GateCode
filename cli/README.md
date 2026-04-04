# gatecode

CLI and TypeScript SDK for [GateCode](https://gatecode.sh) -- the OAuth-style permission gateway for AI coding agents.

## Install

```bash
npm install -g gatecode
```

Or run directly:

```bash
npx gatecode
```

## Quick Start

```bash
# Save your API key
gatecode login

# Request read access to a repo
gatecode request owner/repo --scope read --reason "Need to analyze codebase"

# Request access and wait for approval
gatecode request owner/repo --scope write --reason "Fix typo in README" --wait

# Check request status
gatecode status 42

# See your config
gatecode whoami

# List your API keys
gatecode keys
```

Use `--json` for machine-readable output:

```bash
gatecode request owner/repo --scope read --json
```

## SDK Usage

```typescript
import { GateCode } from "gatecode";

const gc = new GateCode({
  apiKey: process.env.GATECODE_API_KEY!,
});

// Request access and wait for approval
const result = await gc.requestAndWait({
  repo: "owner/repo",
  scope: "write",
  reason: "Implement feature X",
});

if (result.status === "approved") {
  console.log("Access granted! Token:", result.token);
} else if (result.status === "denied") {
  console.log("Access denied.");
} else {
  console.log("Timed out waiting for approval.");
}
```

Or handle polling yourself:

```typescript
// Fire and forget
const req = await gc.request({
  repo: "owner/repo",
  scope: "read",
});
console.log("Request ID:", req.id);

// Check later
const status = await gc.status(req.id);
console.log("Status:", status.status);
```

## Environment Variables

| Variable | Description |
|---|---|
| `GATECODE_API_KEY` | Your API key |
| `GATECODE_USERNAME` | Your username |

## License

MIT

---

[gatecode.sh](https://gatecode.sh)

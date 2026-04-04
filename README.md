# GateCode

> Gate your code. OAuth-style permission gateway for AI coding agents.

AI agents write code fast -- but should they `rm -rf /` without asking? GateCode sits between your AI coding agent and dangerous operations, requiring human approval before anything runs. Think OAuth consent screens, but for every file write, shell command, or deploy your agent wants to make. Real-time notifications, one-click approve/deny, and auto-rules so you stay in control without slowing down.

## Quick Start

```bash
# 1. Sign up with GitHub
open https://gatecode.sh

# 2. Create an API key in the dashboard
#    (Settings → API Keys → Create)

# 3. Install the CLI
npx gatecode init

# 4. Send your first permission request
npx gatecode request --action "write" --resource "src/index.ts" --reason "Add error handling"
```

## How It Works

```
┌─────────┐     POST /api/request      ┌───────────┐
│  Agent   │ ─────────────────────────► │  GateCode │
└─────────┘                             └─────┬─────┘
                                              │
                              SSE + Slack/Discord/Webhook
                                              │
                                              ▼
                                        ┌───────────┐
                                        │  Human    │
                                        │  Reviewer │
                                        └─────┬─────┘
                                              │
                                      Approve / Deny
                                              │
                                              ▼
┌─────────┐    GET /api/status/:id      ┌───────────┐
│  Agent   │ ◄───────────────────────── │  GateCode │
│ proceeds │    { status: "approved" }  └───────────┘
└─────────┘
```

## Features

**Core**
- Permission request/approve/deny with real-time SSE streaming
- Auto-approve and auto-deny rules with glob patterns
- API key authentication (`gk_` prefix, SHA-256 hashed at rest)
- Rate limiting per key
- Full audit log with filters and pagination

**Notifications**
- Slack notifications (incoming webhooks)
- Discord notifications (webhook integration)
- Generic webhook support with HMAC signing
- Real-time SSE push to the dashboard

**Integrations**
- MCP OAuth 2.1 server (discovery, PKCE, dynamic client registration)
- GitHub OAuth login
- `.gatecode.yml` permissions-as-code config

**Billing**
- Free tier included
- Pro ($9/mo) | Team ($29/mo) | Enterprise ($99/mo)
- Stripe Checkout + Customer Portal
- Usage-based limits per plan

## CLI

```bash
# Install globally (or use npx -- zero deps)
npm install -g gatecode

# Request permission for an action
npx gatecode request \
  --action "exec" \
  --resource "rm -rf dist/" \
  --reason "Clean build artifacts"

# Check request status
npx gatecode status req_abc123

# List pending requests
npx gatecode pending
```

## SDK

```bash
npm install gatecode
```

```typescript
import { GateCode } from "gatecode";

const gate = new GateCode({ apiKey: process.env.GATECODE_API_KEY });

// Request permission and wait for approval
const result = await gate.request({
  action: "write",
  resource: "src/database.ts",
  reason: "Add migration for users table",
});

if (result.status === "approved") {
  // proceed with the operation
}
```

## API Reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/request` | API Key | Create a permission request |
| `GET` | `/api/status/:id` | API Key | Poll request status |
| `GET` | `/api/pending` | Session | List pending requests |
| `POST` | `/api/approve/:id` | Session | Approve a request |
| `POST` | `/api/deny/:id` | Session | Deny a request |
| `GET` | `/api/rules` | Session | List auto-approve/deny rules |
| `POST` | `/api/rules` | Session | Create a rule |
| `DELETE` | `/api/rules/:id` | Session | Delete a rule |
| `GET` | `/api/keys` | Session | List API keys |
| `POST` | `/api/keys` | Session | Create an API key |
| `DELETE` | `/api/keys/:id` | Session | Revoke an API key |
| `GET` | `/api/audit` | Session | Query audit log |
| `GET` | `/api/webhooks` | Session | List webhooks |
| `POST` | `/api/webhooks` | Session | Create a webhook |
| `DELETE` | `/api/webhooks/:id` | Session | Delete a webhook |
| `POST` | `/api/webhooks/:id/test` | Session | Test a webhook |
| `POST` | `/api/billing/checkout` | Session | Create Stripe checkout |
| `POST` | `/api/billing/portal` | Session | Open billing portal |
| `GET` | `/api/billing/status` | Session | Get plan status |
| `GET` | `/health` | None | Health check |

## MCP Server

GateCode implements an [MCP](https://modelcontextprotocol.io/) OAuth 2.1 authorization server, so MCP-compatible AI clients can request permissions natively.

**Discovery endpoint:**

```
GET https://gatecode.sh/.well-known/oauth-authorization-server
```

**MCP endpoints:**

| Path | Description |
|------|-------------|
| `POST /mcp/register` | Dynamic client registration |
| `GET /mcp/authorize` | Authorization + consent screen |
| `POST /mcp/token` | Token exchange (PKCE required) |
| `POST /mcp/revoke` | Token revocation |
| `GET /mcp/tools` | List available MCP tools |
| `POST /mcp/execute` | Execute an MCP tool |

## Configuration

Drop a `.gatecode.yml` in your repo root to define permissions-as-code:

```yaml
# .gatecode.yml
version: 1

rules:
  # Auto-approve test file writes
  - action: write
    resource: "tests/**"
    decision: approve

  # Auto-deny anything touching production config
  - action: write
    resource: "config/production.*"
    decision: deny

  # Require approval for shell commands
  - action: exec
    resource: "*"
    decision: ask

notifications:
  slack: https://hooks.slack.com/services/T.../B.../xxx
  discord: https://discord.com/api/webhooks/.../...
```

## Self-Hosting

GateCode runs on Cloudflare Workers with D1 (SQLite) and KV.

```bash
# Clone the repo
git clone https://github.com/gatecode/gatecode.git
cd gatecode

# Install dependencies
npm install

# Set up your environment
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your GitHub OAuth + Stripe keys

# Create D1 database
wrangler d1 create gatecode-db
# Update wrangler.toml with the database_id

# Run migrations
npm run db:migrate

# Local development
npm run dev

# Deploy to production
npm run deploy
```

## Architecture

- **Runtime:** Cloudflare Workers
- **Framework:** Hono
- **Database:** Cloudflare D1 (SQLite)
- **Sessions:** Cloudflare KV
- **Auth:** GitHub OAuth + API keys (SHA-256 hashed)
- **Payments:** Stripe Checkout + Webhooks
- **Real-time:** Server-Sent Events (SSE)
- **Validation:** Zod
- **Language:** TypeScript
- **CLI:** Zero-dependency, runs via `npx`

## License

MIT License. See [LICENSE](./LICENSE).

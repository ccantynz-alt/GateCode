// GateCode — API Documentation page

import { html } from "hono/html";
import type { Context } from "hono";
import type { Env } from "../types";

export const docsPage = async (c: Context<Env>) => {
  return c.html(
    html`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>API Docs — GateCode</title>
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    :root {
      --bg: #0a0a0f; --bg-card: #12121a; --border: #1e1e2e;
      --text: #e2e2f0; --text-dim: #8888a0;
      --blue: #3b82f6; --purple: #8b5cf6; --green: #22c55e; --red: #ef4444; --yellow: #eab308;
      --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      --mono: 'SF Mono', 'Fira Code', Consolas, monospace;
    }
    body { background: var(--bg); color: var(--text); font-family: var(--font); line-height: 1.7; }
    nav {
      position: sticky; top: 0; z-index: 100;
      display: flex; align-items: center; justify-content: space-between;
      padding: 1rem 2rem; background: rgba(10,10,15,.9); backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
    }
    .nav-logo { font-size: 1.25rem; font-weight: 700; color: var(--text); text-decoration: none; }
    .nav-logo span { color: var(--blue); }
    .nav-links { display: flex; gap: 1.5rem; align-items: center; }
    .nav-links a { color: var(--text-dim); font-size: .9rem; text-decoration: none; }
    .nav-links a:hover { color: var(--text); }
    .container { max-width: 860px; margin: 0 auto; padding: 3rem 1.5rem; }
    h1 { font-size: 2.5rem; font-weight: 800; letter-spacing: -.03em; margin-bottom: .5rem; }
    h1 span { color: var(--blue); }
    .subtitle { color: var(--text-dim); font-size: 1.1rem; margin-bottom: 3rem; }
    h2 {
      font-size: 1.4rem; font-weight: 700; margin: 3rem 0 1rem; padding-bottom: .5rem;
      border-bottom: 1px solid var(--border);
    }
    h3 { font-size: 1.1rem; font-weight: 600; margin: 2rem 0 .75rem; }
    p { color: var(--text-dim); margin-bottom: 1rem; }
    a { color: var(--blue); }

    .endpoint {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px;
      margin-bottom: 1.25rem; overflow: hidden;
    }
    .endpoint-header {
      display: flex; align-items: center; gap: .75rem;
      padding: 1rem 1.25rem; cursor: pointer; transition: background .15s;
    }
    .endpoint-header:hover { background: rgba(255,255,255,.02); }
    .method {
      font-family: var(--mono); font-size: .75rem; font-weight: 700;
      text-transform: uppercase; padding: .2rem .5rem; border-radius: 4px;
      min-width: 50px; text-align: center;
    }
    .method.get { background: rgba(59,130,246,.15); color: var(--blue); }
    .method.post { background: rgba(34,197,94,.15); color: var(--green); }
    .method.delete { background: rgba(239,68,68,.15); color: var(--red); }
    .path { font-family: var(--mono); font-size: .9rem; font-weight: 500; }
    .desc { color: var(--text-dim); font-size: .85rem; margin-left: auto; }
    .auth-badge {
      font-family: var(--mono); font-size: .65rem; padding: .15rem .4rem;
      border-radius: 3px; background: rgba(234,179,8,.12); color: var(--yellow);
    }
    .auth-badge.public { background: rgba(34,197,94,.12); color: var(--green); }
    .endpoint-body {
      display: none; padding: 0 1.25rem 1.25rem;
      border-top: 1px solid var(--border); margin-top: 0;
    }
    .endpoint.open .endpoint-body { display: block; padding-top: 1rem; }
    pre {
      background: #0d0d14; border: 1px solid var(--border); border-radius: 8px;
      padding: 1rem; font-family: var(--mono); font-size: .82rem;
      line-height: 1.7; overflow-x: auto; color: var(--text-dim); margin: .75rem 0;
    }
    code { font-family: var(--mono); font-size: .85rem; color: var(--blue); background: rgba(59,130,246,.08); padding: .1rem .35rem; border-radius: 3px; }
    table { width: 100%; border-collapse: collapse; margin: .75rem 0; font-size: .85rem; }
    th { text-align: left; padding: .5rem; color: var(--text-dim); font-size: .75rem; text-transform: uppercase; letter-spacing: .05em; border-bottom: 1px solid var(--border); }
    td { padding: .5rem; border-bottom: 1px solid var(--border); }
    td code { font-size: .8rem; }

    @media (max-width: 640px) {
      .container { padding: 2rem 1rem; }
      h1 { font-size: 1.75rem; }
      .desc { display: none; }
    }
  </style>
</head>
<body>
  <nav>
    <a href="/" class="nav-logo">Gate<span>Code</span></a>
    <div class="nav-links">
      <a href="/#features">Features</a>
      <a href="/#pricing">Pricing</a>
      <a href="/docs" style="color:var(--blue);">API Docs</a>
      <a href="/auth/github">Sign In</a>
    </div>
  </nav>

  <div class="container">
    <h1>API <span>Reference</span></h1>
    <p class="subtitle">Everything you need to integrate with GateCode.</p>

    <h2>Authentication</h2>
    <p>API requests are authenticated using API keys passed in the <code>X-GateCode-Key</code> header. Dashboard/session endpoints use cookie-based auth.</p>
    <pre>curl -H "X-GateCode-Key: gk_your_api_key" https://gatecode.sh/api/request</pre>

    <h2>Permission Requests</h2>

    <div class="endpoint">
      <div class="endpoint-header" onclick="this.parentElement.classList.toggle('open')">
        <span class="method post">POST</span>
        <span class="path">/api/request</span>
        <span class="auth-badge public">Public / API Key</span>
        <span class="desc">Request repo access</span>
      </div>
      <div class="endpoint-body">
        <p>Called by AI agents to request permission to access a repository.</p>
        <table>
          <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
          <tr><td><code>agent_id</code></td><td>string</td><td>Yes</td><td>Agent identifier</td></tr>
          <tr><td><code>repo</code></td><td>string</td><td>Yes</td><td>Repository (owner/repo)</td></tr>
          <tr><td><code>scope</code></td><td>"read" | "write"</td><td>Yes</td><td>Access scope</td></tr>
          <tr><td><code>reason</code></td><td>string</td><td>No</td><td>Why access is needed</td></tr>
          <tr><td><code>username</code></td><td>string</td><td>*</td><td>GitHub username of owner</td></tr>
          <tr><td><code>user_id</code></td><td>number</td><td>*</td><td>GateCode user ID</td></tr>
        </table>
        <p>* Either <code>username</code> or <code>user_id</code> is required.</p>
        <pre>{
  "id": 42,
  "status": "pending"
}</pre>
      </div>
    </div>

    <div class="endpoint">
      <div class="endpoint-header" onclick="this.parentElement.classList.toggle('open')">
        <span class="method get">GET</span>
        <span class="path">/api/status/:id</span>
        <span class="auth-badge public">Public</span>
        <span class="desc">Check request status</span>
      </div>
      <div class="endpoint-body">
        <p>Poll for the status of a permission request. When approved, the token is included.</p>
        <pre>// Pending
{ "id": 42, "status": "pending" }

// Approved
{ "id": 42, "status": "approved", "token": "ghp_...", "expires_at": "2026-04-04T09:00:00Z" }

// Denied
{ "id": 42, "status": "denied" }</pre>
      </div>
    </div>

    <div class="endpoint">
      <div class="endpoint-header" onclick="this.parentElement.classList.toggle('open')">
        <span class="method post">POST</span>
        <span class="path">/api/approve/:id</span>
        <span class="auth-badge">Auth Required</span>
        <span class="desc">Approve a request</span>
      </div>
      <div class="endpoint-body">
        <p>Approve a pending permission request. Issues a scoped token valid for 1 hour.</p>
      </div>
    </div>

    <div class="endpoint">
      <div class="endpoint-header" onclick="this.parentElement.classList.toggle('open')">
        <span class="method post">POST</span>
        <span class="path">/api/deny/:id</span>
        <span class="auth-badge">Auth Required</span>
        <span class="desc">Deny a request</span>
      </div>
      <div class="endpoint-body">
        <p>Deny a pending permission request.</p>
      </div>
    </div>

    <div class="endpoint">
      <div class="endpoint-header" onclick="this.parentElement.classList.toggle('open')">
        <span class="method get">GET</span>
        <span class="path">/api/pending</span>
        <span class="auth-badge">Auth Required</span>
        <span class="desc">SSE stream of pending requests</span>
      </div>
      <div class="endpoint-body">
        <p>Server-Sent Events stream. Emits <code>init</code> with current pending list, then <code>new_request</code>, <code>approved</code>, <code>denied</code> events in real-time.</p>
        <pre>const es = new EventSource('/api/pending');
es.addEventListener('new_request', (e) => {
  const request = JSON.parse(e.data);
  console.log('New request:', request);
});</pre>
      </div>
    </div>

    <h2>Rules</h2>

    <div class="endpoint">
      <div class="endpoint-header" onclick="this.parentElement.classList.toggle('open')">
        <span class="method get">GET</span>
        <span class="path">/api/rules</span>
        <span class="auth-badge">Auth Required</span>
        <span class="desc">List auto-approve/deny rules</span>
      </div>
      <div class="endpoint-body">
        <p>Returns all rules for the authenticated user.</p>
      </div>
    </div>

    <div class="endpoint">
      <div class="endpoint-header" onclick="this.parentElement.classList.toggle('open')">
        <span class="method post">POST</span>
        <span class="path">/api/rules</span>
        <span class="auth-badge">Auth Required</span>
        <span class="desc">Create a rule (Pro+)</span>
      </div>
      <div class="endpoint-body">
        <table>
          <tr><th>Field</th><th>Type</th><th>Description</th></tr>
          <tr><td><code>pattern</code></td><td>string</td><td>Glob pattern (e.g. <code>org/*</code>)</td></tr>
          <tr><td><code>scope</code></td><td>"read" | "write"</td><td>Access scope</td></tr>
          <tr><td><code>action</code></td><td>"auto_approve" | "auto_deny" | "ask"</td><td>What to do when matched</td></tr>
        </table>
      </div>
    </div>

    <div class="endpoint">
      <div class="endpoint-header" onclick="this.parentElement.classList.toggle('open')">
        <span class="method delete">DEL</span>
        <span class="path">/api/rules/:id</span>
        <span class="auth-badge">Auth Required</span>
        <span class="desc">Delete a rule</span>
      </div>
      <div class="endpoint-body"><p>Deletes a rule. Must be owned by the authenticated user.</p></div>
    </div>

    <h2>API Keys</h2>

    <div class="endpoint">
      <div class="endpoint-header" onclick="this.parentElement.classList.toggle('open')">
        <span class="method get">GET</span>
        <span class="path">/api/keys</span>
        <span class="auth-badge">Auth Required</span>
        <span class="desc">List API keys</span>
      </div>
      <div class="endpoint-body"><p>Returns all API keys for the authenticated user. The full key is never returned after creation.</p></div>
    </div>

    <div class="endpoint">
      <div class="endpoint-header" onclick="this.parentElement.classList.toggle('open')">
        <span class="method post">POST</span>
        <span class="path">/api/keys</span>
        <span class="auth-badge">Auth Required</span>
        <span class="desc">Create API key</span>
      </div>
      <div class="endpoint-body">
        <table>
          <tr><th>Field</th><th>Type</th><th>Description</th></tr>
          <tr><td><code>name</code></td><td>string</td><td>Descriptive name</td></tr>
          <tr><td><code>scopes</code></td><td>string</td><td>Comma-separated scopes (default: "request")</td></tr>
        </table>
        <p>Returns the full key <strong>once</strong>. Store it securely.</p>
        <pre>{ "id": 1, "name": "my-key", "key": "gk_a1b2c3d4...", "key_prefix": "gk_a1b2" }</pre>
      </div>
    </div>

    <h2>Audit Log</h2>

    <div class="endpoint">
      <div class="endpoint-header" onclick="this.parentElement.classList.toggle('open')">
        <span class="method get">GET</span>
        <span class="path">/api/audit</span>
        <span class="auth-badge">Auth Required</span>
        <span class="desc">Query audit log</span>
      </div>
      <div class="endpoint-body">
        <p>Query params: <code>limit</code> (max 100), <code>offset</code>, <code>repo</code>, <code>agent_id</code></p>
      </div>
    </div>

    <h2>Webhooks</h2>

    <div class="endpoint">
      <div class="endpoint-header" onclick="this.parentElement.classList.toggle('open')">
        <span class="method post">POST</span>
        <span class="path">/api/webhooks</span>
        <span class="auth-badge">Auth Required</span>
        <span class="desc">Create webhook (Slack/Discord/generic)</span>
      </div>
      <div class="endpoint-body">
        <table>
          <tr><th>Field</th><th>Type</th><th>Description</th></tr>
          <tr><td><code>name</code></td><td>string</td><td>Webhook name</td></tr>
          <tr><td><code>url</code></td><td>string</td><td>Webhook URL</td></tr>
          <tr><td><code>type</code></td><td>"generic" | "slack" | "discord"</td><td>Notification format</td></tr>
        </table>
        <p>Generic webhooks receive HMAC-SHA256 signed payloads via <code>X-GateCode-Signature</code>.</p>
      </div>
    </div>

    <h2>MCP Server</h2>
    <p>GateCode implements an OAuth 2.1-compatible MCP authorization server. MCP clients (Claude Code, Cursor, etc.) can discover and connect automatically.</p>

    <div class="endpoint">
      <div class="endpoint-header" onclick="this.parentElement.classList.toggle('open')">
        <span class="method get">GET</span>
        <span class="path">/.well-known/oauth-authorization-server</span>
        <span class="auth-badge public">Public</span>
        <span class="desc">OAuth 2.1 metadata discovery</span>
      </div>
      <div class="endpoint-body">
        <p>Returns OAuth server metadata including authorization, token, and registration endpoints. Supports PKCE with S256.</p>
      </div>
    </div>

    <div class="endpoint">
      <div class="endpoint-header" onclick="this.parentElement.classList.toggle('open')">
        <span class="method post">POST</span>
        <span class="path">/mcp/execute</span>
        <span class="auth-badge">Bearer Token</span>
        <span class="desc">Execute MCP tool</span>
      </div>
      <div class="endpoint-body">
        <p>Available tools:</p>
        <table>
          <tr><th>Tool</th><th>Description</th></tr>
          <tr><td><code>request_repo_access</code></td><td>Request access to a GitHub repository</td></tr>
          <tr><td><code>check_access_status</code></td><td>Check if a request was approved</td></tr>
          <tr><td><code>list_approved_repos</code></td><td>List repos with active access</td></tr>
        </table>
        <pre>POST /mcp/execute
Authorization: Bearer &lt;token&gt;

{ "tool": "request_repo_access", "input": { "repo": "acme/api", "scope": "write" } }</pre>
      </div>
    </div>

    <h2>Billing</h2>

    <div class="endpoint">
      <div class="endpoint-header" onclick="this.parentElement.classList.toggle('open')">
        <span class="method post">POST</span>
        <span class="path">/api/billing/checkout</span>
        <span class="auth-badge">Auth Required</span>
        <span class="desc">Start Stripe checkout</span>
      </div>
      <div class="endpoint-body">
        <p>Body: <code>{ "plan": "pro" | "team" | "enterprise" }</code>. Returns <code>{ "url": "https://checkout.stripe.com/..." }</code></p>
      </div>
    </div>

    <div class="endpoint">
      <div class="endpoint-header" onclick="this.parentElement.classList.toggle('open')">
        <span class="method post">POST</span>
        <span class="path">/api/billing/portal</span>
        <span class="auth-badge">Auth Required</span>
        <span class="desc">Open Stripe portal</span>
      </div>
      <div class="endpoint-body">
        <p>Returns a URL to the Stripe Customer Portal for managing subscriptions.</p>
      </div>
    </div>

    <h2>Rate Limits</h2>
    <p>All API endpoints include rate limit headers:</p>
    <table>
      <tr><th>Header</th><th>Description</th></tr>
      <tr><td><code>X-RateLimit-Limit</code></td><td>Max requests per window</td></tr>
      <tr><td><code>X-RateLimit-Remaining</code></td><td>Requests remaining</td></tr>
      <tr><td><code>X-RateLimit-Reset</code></td><td>Window reset timestamp</td></tr>
    </table>
    <p>Authenticated requests: 60/min. Unauthenticated: 10/min. Returns <code>429</code> with <code>Retry-After</code> header when exceeded.</p>
  </div>

  <footer style="border-top:1px solid var(--border);padding:2rem;text-align:center;">
    <p style="color:var(--text-dim);font-size:.85rem;">GateCode &copy; 2026 &middot; <a href="/">Home</a> &middot; <a href="/dashboard">Dashboard</a></p>
  </footer>
</body>
</html>`
  );
};

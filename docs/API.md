# GateCode API Reference

## Base URL

```
https://gatecode.<your-domain>.workers.dev
```

## Authentication

GateCode supports three authentication methods:

| Method | Header / Mechanism | Use Case |
|---|---|---|
| **Session cookie** | `Cookie: session=<id>` | Browser-based dashboard access. Set automatically after GitHub OAuth login. |
| **API key** | `X-GateCode-Key: gk_...` | Programmatic access from AI agents and scripts. |
| **Bearer token** | `Authorization: Bearer <token>` | Alternative programmatic access. |

Session cookies are issued via the OAuth flow (`GET /auth/github`). API keys are created through `POST /api/keys` and are prefixed with `gk_`.

## Rate Limiting

Rate limits are applied per-user (authenticated) or per-IP (unauthenticated).

| Context | Limit |
|---|---|
| Authenticated requests to `POST /api/request` | 60 requests / 60 seconds |
| Unauthenticated requests to `POST /api/request` | 10 requests / 60 seconds |

Rate limit information is returned in response headers:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 57
X-RateLimit-Reset: 1714000000
```

When the limit is exceeded, a `429 Too Many Requests` response is returned with a `Retry-After` header.

---

## Authentication Endpoints

### `GET /auth/github`

Redirect the user to GitHub for OAuth authorization.

**Authentication:** None

**Response:** `302` redirect to `https://github.com/login/oauth/authorize` with CSRF state stored in KV (10-minute TTL).

**OAuth scopes requested:** `repo`, `read:user`, `user:email`

---

### `GET /auth/callback`

Handle the GitHub OAuth callback. Exchanges the authorization code for an access token, upserts the user in the database, creates a session in KV (24-hour TTL), and sets an `HttpOnly` session cookie.

**Authentication:** None

**Query Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `code` | string | Yes | GitHub authorization code |
| `state` | string | Yes | CSRF state token |

**Success Response:** `302` redirect to `/dashboard` with `Set-Cookie` header.

**Error Responses:**

| Status | Body | Condition |
|---|---|---|
| `400` | `Missing code or state parameter` | Missing query params |
| `403` | `Invalid or expired state parameter` | CSRF validation failed |
| `502` | Error message | GitHub token exchange or user fetch failed |

---

### `POST /auth/logout`

Destroy the current session and clear the session cookie.

**Authentication:** Session cookie (reads it to delete the session)

**Response:** `302` redirect to `/`.

---

## Permission Request Endpoints

### `POST /api/request`

Submit a permission request on behalf of an AI agent. This is the primary entry point for agents requesting access to a repository.

The system evaluates auto-approve/auto-deny rules before creating the request. If no rule matches (or the matching rule action is `ask`), the request is created with `pending` status and connected SSE clients are notified.

**Authentication:** Optional. API key via `X-GateCode-Key` header. If no API key is provided, `user_id` or `username` must be included in the body.

**Request Body:**

```json
{
  "agent_id": "my-agent-v1",
  "repo": "octocat/hello-world",
  "scope": "read",
  "reason": "Need to read README for context",
  "user_id": 1,
  "username": "octocat"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `agent_id` | string | Yes | Identifier for the AI agent |
| `repo` | string | Yes | Repository in `owner/name` format |
| `scope` | `"read"` \| `"write"` | Yes | Permission scope requested |
| `reason` | string | No | Human-readable reason for the request |
| `user_id` | number | No | Target user ID (not needed if API key is used or `username` is provided) |
| `username` | string | No | Target username (resolved to user ID) |

**Success Responses:**

Auto-approved (rule matched):

```json
{
  "id": 42,
  "status": "approved",
  "token": "auto_approved_token",
  "expires_at": "2025-01-01T01:00:00.000Z"
}
```

Auto-denied (rule matched):

```json
{
  "id": 43,
  "status": "denied"
}
```

Pending (no rule matched or rule action is `ask`):

```json
{
  "id": 44,
  "status": "pending"
}
```

**Error Responses:**

| Status | Body | Condition |
|---|---|---|
| `400` | `{ "error": "Either user_id or username is required" }` | No user identifier provided and no API key |
| `401` | `{ "error": "Invalid API key" }` | Invalid `X-GateCode-Key` header |
| `403` | `{ "error": "API key lacks 'request' scope" }` | API key does not have the `request` scope |
| `404` | `{ "error": "User not found" }` | Username does not exist |
| `429` | `{ "error": "Too many requests" }` | Rate limit exceeded |

---

### `GET /api/pending`

Server-Sent Events (SSE) stream of pending permission requests for the authenticated user. On connection, emits an `init` event with all currently pending requests, then streams live `new_request`, `approved`, and `denied` events.

**Authentication:** Required (session cookie or Bearer token)

**Response:** `text/event-stream`

**Event format:**

```
event: init
data: [{"id":1,"agent_id":"agent-1","repo":"owner/repo","scope":"read","status":"pending",...}]

event: new_request
data: {"id":2,"agent_id":"agent-2","repo":"owner/repo2","scope":"write","reason":"deploy fix"}

event: approved
data: {"id":1,"status":"approved","token":"ghu_...","expires_at":"2025-01-01T01:00:00.000Z",...}

event: denied
data: {"id":3,"status":"denied",...}
```

---

### `POST /api/approve/:id`

Approve a pending permission request. Issues a scoped GitHub token and sets a 1-hour expiry.

**Authentication:** Required (session cookie or Bearer token)

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `id` | number | Permission request ID |

**Success Response:** `200`

```json
{
  "id": 42,
  "user_id": 1,
  "agent_id": "my-agent-v1",
  "repo": "octocat/hello-world",
  "scope": "read",
  "status": "approved",
  "token": "ghu_xxxxxxxxxxxx",
  "expires_at": "2025-01-01T01:00:00.000Z",
  "reason": "Need to read README",
  "created_at": "2025-01-01T00:00:00.000Z"
}
```

**Error Responses:**

| Status | Body | Condition |
|---|---|---|
| `400` | `{ "error": "Invalid permission id" }` | Non-numeric ID |
| `403` | `{ "error": "Forbidden" }` | Permission belongs to another user |
| `404` | `{ "error": "Permission not found" }` | ID does not exist |
| `409` | `{ "error": "Permission already resolved" }` | Already approved or denied |

---

### `POST /api/deny/:id`

Deny a pending permission request.

**Authentication:** Required (session cookie or Bearer token)

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `id` | number | Permission request ID |

**Success Response:** `200`

```json
{
  "id": 43,
  "user_id": 1,
  "agent_id": "my-agent-v1",
  "repo": "octocat/hello-world",
  "scope": "write",
  "status": "denied",
  "token": null,
  "expires_at": null,
  "reason": "Automated deploy",
  "created_at": "2025-01-01T00:00:00.000Z"
}
```

**Error Responses:**

| Status | Body | Condition |
|---|---|---|
| `400` | `{ "error": "Invalid permission id" }` | Non-numeric ID |
| `403` | `{ "error": "Forbidden" }` | Permission belongs to another user |
| `404` | `{ "error": "Permission not found" }` | ID does not exist |
| `409` | `{ "error": "Permission already resolved" }` | Already approved or denied |

---

### `GET /api/status/:id`

Poll the status of a permission request. Designed for agents to check whether their request has been approved, denied, or is still pending.

**Authentication:** None (public endpoint)

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `id` | number | Permission request ID |

**Success Responses:**

Approved:

```json
{
  "id": 42,
  "status": "approved",
  "token": "ghu_xxxxxxxxxxxx",
  "expires_at": "2025-01-01T01:00:00.000Z"
}
```

Pending or Denied:

```json
{
  "id": 43,
  "status": "pending"
}
```

```json
{
  "id": 44,
  "status": "denied"
}
```

**Error Responses:**

| Status | Body | Condition |
|---|---|---|
| `400` | `{ "error": "Invalid permission id" }` | Non-numeric ID |
| `404` | `{ "error": "Permission not found" }` | ID does not exist |

---

## Rule Management Endpoints

Rules allow users to define auto-approve, auto-deny, or ask policies for specific repository patterns and scopes. Rules are evaluated in reverse chronological order (newest first) when a permission request is submitted.

### `GET /api/rules`

List all rules for the authenticated user.

**Authentication:** Required

**Success Response:** `200`

```json
[
  {
    "id": 1,
    "user_id": 1,
    "pattern": "octocat/*",
    "scope": "read",
    "action": "auto_approve",
    "created_at": "2025-01-01T00:00:00.000Z"
  }
]
```

---

### `POST /api/rules`

Create a new auto-approve, auto-deny, or ask rule. Requires a paid plan (pro, team, or enterprise).

**Authentication:** Required

**Request Body:**

```json
{
  "pattern": "octocat/*",
  "scope": "read",
  "action": "auto_approve"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `pattern` | string | Yes | Glob pattern matching repository names (e.g., `octocat/*`, `*`) |
| `scope` | `"read"` \| `"write"` | Yes | Permission scope this rule applies to |
| `action` | `"auto_approve"` \| `"auto_deny"` \| `"ask"` | Yes | Action to take when the rule matches |

**Success Response:** `201`

```json
{
  "id": 2,
  "user_id": 1,
  "pattern": "octocat/*",
  "scope": "read",
  "action": "auto_approve",
  "created_at": "2025-01-01T00:00:00.000Z"
}
```

**Error Responses:**

| Status | Body | Condition |
|---|---|---|
| `403` | `{ "error": "Rules are not available on the free plan..." }` | User is on the free plan |

---

### `DELETE /api/rules/:id`

Delete a rule owned by the authenticated user.

**Authentication:** Required

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `id` | number | Rule ID |

**Success Response:** `204 No Content`

**Error Responses:**

| Status | Body | Condition |
|---|---|---|
| `400` | `{ "error": "Invalid rule id" }` | Non-numeric ID |
| `404` | `{ "error": "Rule not found or not owned by you" }` | Rule does not exist or belongs to another user |

---

## API Key Management Endpoints

### `GET /api/keys`

List all API keys for the authenticated user. Keys are returned with metadata only (the raw key value is never retrievable after creation).

**Authentication:** Required

**Success Response:** `200`

```json
{
  "keys": [
    {
      "id": 1,
      "user_id": 1,
      "name": "My CI Key",
      "key_prefix": "gk_a1b2",
      "scopes": "request",
      "created_at": "2025-01-01T00:00:00.000Z",
      "last_used_at": "2025-01-01T12:00:00.000Z"
    }
  ]
}
```

---

### `POST /api/keys`

Create a new API key. The full key is returned only once in the response -- store it securely.

**Authentication:** Required

**Request Body:**

```json
{
  "name": "My CI Key",
  "scopes": "request"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | Yes | Display name for the key (1-100 characters) |
| `scopes` | string | No | Comma-separated scopes. Defaults to `"request"`. |

**Success Response:** `201`

```json
{
  "id": 1,
  "name": "My CI Key",
  "key": "gk_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5",
  "key_prefix": "gk_a1b2",
  "scopes": "request",
  "created_at": "2025-01-01T00:00:00.000Z"
}
```

---

### `DELETE /api/keys/:id`

Delete an API key owned by the authenticated user.

**Authentication:** Required

**Path Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `id` | number | API key ID |

**Success Response:** `200`

```json
{
  "ok": true
}
```

**Error Responses:**

| Status | Body | Condition |
|---|---|---|
| `400` | `{ "error": "Invalid key id" }` | Non-numeric ID |
| `404` | `{ "error": "API key not found" }` | Key does not exist or belongs to another user |

---

## Audit Log Endpoints

### `GET /api/audit`

Query the audit log for the authenticated user with optional filters and pagination.

**Authentication:** Required

**Query Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `limit` | number | `50` | Results per page (max 100) |
| `offset` | number | `0` | Offset for pagination |
| `repo` | string | -- | Filter by exact repository name |
| `agent_id` | string | -- | Filter by agent ID |

**Success Response:** `200`

```json
{
  "data": [
    {
      "id": 1,
      "user_id": 1,
      "agent_id": "my-agent-v1",
      "repo": "octocat/hello-world",
      "scope": "read",
      "action": "approved",
      "ip_address": "203.0.113.1",
      "timestamp": "2025-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 1,
    "limit": 50,
    "offset": 0
  }
}
```

Possible `action` values: `approved`, `denied`, `auto_approved`, `auto_denied`.

---

## Billing Endpoints

### `POST /api/billing/checkout`

Create a Stripe Checkout session to subscribe to a paid plan.

**Authentication:** Required

**Request Body:**

```json
{
  "plan": "pro"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `plan` | `"pro"` \| `"team"` \| `"enterprise"` | Yes | Target plan |

**Success Response:** `200`

```json
{
  "url": "https://checkout.stripe.com/c/pay/cs_live_..."
}
```

**Error Responses:**

| Status | Body | Condition |
|---|---|---|
| `400` | `{ "error": "Invalid plan. Must be one of: pro, team, enterprise" }` | Invalid plan value |

---

### `POST /api/billing/portal`

Create a Stripe Customer Portal session for managing subscriptions, payment methods, and invoices.

**Authentication:** Required

**Success Response:** `200`

```json
{
  "url": "https://billing.stripe.com/p/session/..."
}
```

**Error Responses:**

| Status | Body | Condition |
|---|---|---|
| `400` | `{ "error": "No billing account found. Subscribe to a plan first." }` | User has no Stripe customer ID |

---

### `POST /api/billing/webhook`

Stripe webhook endpoint. Verifies the `Stripe-Signature` header and processes subscription lifecycle events.

**Authentication:** None (verified via Stripe webhook signature)

**Headers:**

| Header | Required | Description |
|---|---|---|
| `Stripe-Signature` | Yes | Stripe webhook signature |

**Handled Events:**

- `checkout.session.completed` -- Updates user plan after successful checkout
- `customer.subscription.updated` -- Syncs plan changes
- `customer.subscription.deleted` -- Reverts user to free plan

**Success Response:** `200`

```json
{
  "received": true
}
```

**Error Responses:**

| Status | Body | Condition |
|---|---|---|
| `400` | `{ "error": "Missing Stripe-Signature header" }` | No signature header |
| `400` | `{ "error": "Invalid webhook signature" }` | Signature verification failed |

---

### `GET /api/billing/status`

Get the current billing status for the authenticated user.

**Authentication:** Required

**Success Response:** `200`

```json
{
  "plan": "pro",
  "stripe_customer_id": true,
  "has_subscription": true
}
```

Note: `stripe_customer_id` is a boolean indicating whether a Stripe customer record exists (the actual ID is not exposed).

---

## Common Error Format

All error responses follow a consistent format:

```json
{
  "error": "Description of the error"
}
```

## HTTP Status Codes

| Code | Meaning |
|---|---|
| `200` | Success |
| `201` | Created |
| `204` | No Content (successful deletion) |
| `302` | Redirect (OAuth flow) |
| `400` | Bad Request (validation error or missing params) |
| `401` | Unauthorized (invalid or missing authentication) |
| `403` | Forbidden (insufficient permissions or plan restriction) |
| `404` | Not Found |
| `409` | Conflict (permission already resolved) |
| `429` | Too Many Requests (rate limit exceeded) |
| `502` | Bad Gateway (upstream service error, e.g., GitHub API) |

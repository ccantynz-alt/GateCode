// GateCode — Permission request routes

import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type { Env } from "../types";
import { authMiddleware } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";
import { sseManager } from "../lib/notifications";
import {
  createPermission,
  getPendingPermissions,
  getPermissionById,
  approvePermission,
  denyPermission,
  addAuditLog,
  getApiKeyByHash,
  touchApiKey,
} from "../db/queries";
import type { Rule, Permission } from "../db/queries";
import {
  sendWebhook,
  sendSlackNotification,
  sendDiscordNotification,
} from "../lib/webhooks";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a glob-style pattern (with * wildcards) into a RegExp. */
function globToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const regexStr = "^" + escaped.replace(/\*/g, ".*") + "$";
  return new RegExp(regexStr);
}

/** Check whether a repo matches a rule pattern. */
function matchesPattern(repo: string, pattern: string): boolean {
  return globToRegex(pattern).test(repo);
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const app = new Hono<Env>();

// ── Helper: hash a key with SHA-256 ─────────────────────────────────────

async function hashKey(key: string): Promise<string> {
  const encoded = new TextEncoder().encode(key);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── POST /api/request — Public endpoint called by AI agents ─────────────

const requestBodySchema = z.object({
  agent_id: z.string().min(1),
  repo: z.string().min(1),
  scope: z.enum(["read", "write"]),
  reason: z.string().optional(),
  user_id: z.number().optional(),
  username: z.string().optional(),
});

// Rate limiting: applied inside the handler after determining auth status
const authenticatedRateLimit = rateLimit({ max: 60, window: 60 });
const unauthenticatedRateLimit = rateLimit({ max: 10, window: 60 });

app.post("/api/request", zValidator("json", requestBodySchema), async (c) => {
  const body = c.req.valid("json");

  // ── API key authentication via X-GateCode-Key header ──────────────────
  let apiKeyUserId: number | undefined;
  const apiKeyHeader = c.req.header("X-GateCode-Key");
  if (apiKeyHeader) {
    const keyHash = await hashKey(apiKeyHeader);
    const apiKey = await getApiKeyByHash(c.env.DB, keyHash);
    if (!apiKey) {
      return c.json({ error: "Invalid API key" }, 401);
    }
    // Check that the key has the 'request' scope
    const scopes = apiKey.scopes.split(",").map((s) => s.trim());
    if (!scopes.includes("request")) {
      return c.json({ error: "API key lacks 'request' scope" }, 403);
    }
    apiKeyUserId = apiKey.user_id;
    // Update last_used_at in the background
    c.executionCtx.waitUntil(touchApiKey(c.env.DB, apiKey.id));
  }

  // ── Apply rate limiting based on auth status ──────────────────────────
  const isAuthenticated = !!apiKeyUserId || !!c.get("user" as never);
  const rateLimitMiddleware = isAuthenticated
    ? authenticatedRateLimit
    : unauthenticatedRateLimit;

  // Run rate limiter — if it returns a response, that means 429
  const rateLimitResponse = await rateLimitMiddleware(c, async () => {
    // continue
  });
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  // Resolve the target user
  let userId: number | undefined = apiKeyUserId ?? body.user_id;
  if (!userId && body.username) {
    const user = await c.env.DB.prepare(
      "SELECT id FROM users WHERE username = ?"
    )
      .bind(body.username)
      .first<{ id: number }>();
    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }
    userId = user.id;
  }

  if (!userId) {
    return c.json(
      { error: "Either user_id or username is required" },
      400
    );
  }

  // ── Check auto-approve / auto-deny rules ──────────────────────────────
  const { results: rules } = await c.env.DB.prepare(
    "SELECT * FROM rules WHERE user_id = ? AND scope = ? ORDER BY created_at DESC"
  )
    .bind(userId, body.scope)
    .all<Rule>();

  for (const rule of rules) {
    if (!matchesPattern(body.repo, rule.pattern)) continue;

    const ip = c.req.header("CF-Connecting-IP") ?? null;

    if (rule.action === "auto_approve") {
      const permId = await createPermission(c.env.DB, {
        user_id: userId,
        agent_id: body.agent_id,
        repo: body.repo,
        scope: body.scope,
        reason: body.reason ?? null,
      });

      // Auto-approve: set a token immediately (MVP: placeholder)
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      await approvePermission(c.env.DB, permId, "auto_approved_token", expiresAt);

      await addAuditLog(c.env.DB, {
        user_id: userId,
        agent_id: body.agent_id,
        repo: body.repo,
        scope: body.scope,
        action: "auto_approved",
        ip_address: ip,
      });

      return c.json({
        id: permId,
        status: "approved",
        token: "auto_approved_token",
        expires_at: expiresAt,
      });
    }

    if (rule.action === "auto_deny") {
      const permId = await createPermission(c.env.DB, {
        user_id: userId,
        agent_id: body.agent_id,
        repo: body.repo,
        scope: body.scope,
        reason: body.reason ?? null,
      });

      await denyPermission(c.env.DB, permId);

      await addAuditLog(c.env.DB, {
        user_id: userId,
        agent_id: body.agent_id,
        repo: body.repo,
        scope: body.scope,
        action: "auto_denied",
        ip_address: ip,
      });

      return c.json({ id: permId, status: "denied" });
    }

    // rule.action === "ask" — fall through to manual flow
    break;
  }

  // ── No matching rule or rule says "ask" — create pending permission ───
  const permId = await createPermission(c.env.DB, {
    user_id: userId,
    agent_id: body.agent_id,
    repo: body.repo,
    scope: body.scope,
    reason: body.reason ?? null,
  });

  // Notify connected SSE clients
  sseManager.notify(userId, "new_request", {
    id: permId,
    agent_id: body.agent_id,
    repo: body.repo,
    scope: body.scope,
    reason: body.reason ?? null,
  });

  // Fire webhook notifications asynchronously
  const appUrl = c.env.APP_URL || "https://gatecode.sh";
  c.executionCtx.waitUntil(
    (async () => {
      const { results: hooks } = await c.env.DB.prepare(
        "SELECT * FROM webhooks WHERE user_id = ? AND active = 1"
      )
        .bind(userId)
        .all<{ id: number; url: string; secret: string; type: string }>();

      const notifData = {
        agent_id: body.agent_id,
        repo: body.repo,
        scope: body.scope,
        reason: body.reason ?? undefined,
        approveUrl: `${appUrl}/dashboard`,
        denyUrl: `${appUrl}/dashboard`,
      };

      for (const hook of hooks) {
        if (hook.type === "slack") {
          sendSlackNotification(hook.url, "new_request", notifData);
        } else if (hook.type === "discord") {
          sendDiscordNotification(hook.url, "new_request", notifData);
        } else {
          sendWebhook(hook.url, hook.secret, "new_request", {
            event: "new_request",
            permission_id: permId,
            ...notifData,
            timestamp: new Date().toISOString(),
          });
        }
      }
    })()
  );

  return c.json({ id: permId, status: "pending" });
});

// ── GET /api/pending — SSE stream (auth required) ───────────────────────

app.get("/api/pending", authMiddleware, async (c) => {
  const user = c.get("user");
  const userId = Number(user.id);

  // Send current pending permissions as initial burst
  const pending = await getPendingPermissions(c.env.DB, userId);
  const readable = sseManager.addClient(userId);

  // We need to prepend the initial data before the live stream.
  // Create a wrapper stream that emits initial data then pipes live events.
  const { readable: out, writable } = new TransformStream();
  const writer = writable.getWriter();

  const encoder = new TextEncoder();

  // Write initial pending list then pipe the live SSE stream
  (async () => {
    try {
      const initMsg = `event: init\ndata: ${JSON.stringify(pending)}\n\n`;
      await writer.write(encoder.encode(initMsg));

      // Pipe the live SSE stream
      const reader = readable.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await writer.write(value);
      }
    } catch {
      // Client disconnected
    } finally {
      try {
        await writer.close();
      } catch {
        // already closed
      }
    }
  })();

  return new Response(out, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});

// ── POST /api/approve/:id — Auth required ───────────────────────────────

app.post("/api/approve/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  const userId = Number(user.id);
  const permId = Number(c.req.param("id"));

  if (isNaN(permId)) {
    return c.json({ error: "Invalid permission id" }, 400);
  }

  const perm = await getPermissionById(c.env.DB, permId);
  if (!perm) {
    return c.json({ error: "Permission not found" }, 404);
  }
  if (perm.user_id !== userId) {
    return c.json({ error: "Forbidden" }, 403);
  }
  if (perm.status !== "pending") {
    return c.json({ error: "Permission already resolved" }, 409);
  }

  // MVP: use the user's GitHub OAuth token as the scoped token.
  // In production, create a fine-grained GitHub App installation token.
  const githubToken = c.get("githubToken");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  await approvePermission(c.env.DB, permId, githubToken, expiresAt);

  const ip = c.req.header("CF-Connecting-IP") ?? null;
  await addAuditLog(c.env.DB, {
    user_id: userId,
    agent_id: perm.agent_id,
    repo: perm.repo,
    scope: perm.scope,
    action: "approved",
    ip_address: ip,
  });

  const updated = await getPermissionById(c.env.DB, permId);

  sseManager.notify(userId, "approved", updated);

  return c.json(updated);
});

// ── POST /api/deny/:id — Auth required ──────────────────────────────────

app.post("/api/deny/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  const userId = Number(user.id);
  const permId = Number(c.req.param("id"));

  if (isNaN(permId)) {
    return c.json({ error: "Invalid permission id" }, 400);
  }

  const perm = await getPermissionById(c.env.DB, permId);
  if (!perm) {
    return c.json({ error: "Permission not found" }, 404);
  }
  if (perm.user_id !== userId) {
    return c.json({ error: "Forbidden" }, 403);
  }
  if (perm.status !== "pending") {
    return c.json({ error: "Permission already resolved" }, 409);
  }

  await denyPermission(c.env.DB, permId);

  const ip = c.req.header("CF-Connecting-IP") ?? null;
  await addAuditLog(c.env.DB, {
    user_id: userId,
    agent_id: perm.agent_id,
    repo: perm.repo,
    scope: perm.scope,
    action: "denied",
    ip_address: ip,
  });

  const updated = await getPermissionById(c.env.DB, permId);

  sseManager.notify(userId, "denied", updated);

  return c.json(updated);
});

// ── GET /api/status/:id — Public endpoint for agents to poll ────────────

app.get("/api/status/:id", async (c) => {
  const permId = Number(c.req.param("id"));

  if (isNaN(permId)) {
    return c.json({ error: "Invalid permission id" }, 400);
  }

  const perm = await getPermissionById(c.env.DB, permId);
  if (!perm) {
    return c.json({ error: "Permission not found" }, 404);
  }

  // Only include token/expiry for approved permissions
  if (perm.status === "approved") {
    return c.json({
      id: perm.id,
      status: perm.status,
      token: perm.token,
      expires_at: perm.expires_at,
    });
  }

  return c.json({
    id: perm.id,
    status: perm.status,
  });
});

export default app;

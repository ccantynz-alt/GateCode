// GateCode — Permission request routes

import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type { Env } from "../types";
import { authMiddleware } from "../middleware/auth";
import { sseManager } from "../lib/notifications";
import {
  createPermission,
  getPendingPermissions,
  getPermissionById,
  approvePermission,
  denyPermission,
  addAuditLog,
} from "../db/queries";
import type { Rule, Permission } from "../db/queries";

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

// ── POST /api/request — Public endpoint called by AI agents ─────────────

const requestBodySchema = z.object({
  agent_id: z.string().min(1),
  repo: z.string().min(1),
  scope: z.enum(["read", "write"]),
  reason: z.string().optional(),
  user_id: z.number().optional(),
  username: z.string().optional(),
});

app.post("/api/request", zValidator("json", requestBodySchema), async (c) => {
  const body = c.req.valid("json");

  // Resolve the target user
  let userId: number | undefined = body.user_id;
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

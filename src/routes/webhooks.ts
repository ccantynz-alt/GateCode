// GateCode — Webhook management routes

import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type { Env } from "../types";
import { authMiddleware } from "../middleware/auth";
import { sendWebhook, sendSlackNotification, sendDiscordNotification } from "../lib/webhooks";

const app = new Hono<Env>();

// All routes require authentication
app.use("/api/webhooks/*", authMiddleware);
app.use("/api/webhooks", authMiddleware);

// ── Helper: generate a random hex secret ──────────────────────────────

function generateSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── GET /api/webhooks — list user's webhooks ──────────────────────────

app.get("/api/webhooks", async (c) => {
  const user = c.get("user");
  const { results } = await c.env.DB.prepare(
    "SELECT id, name, url, type, events, active, created_at FROM webhooks WHERE user_id = ? ORDER BY created_at DESC"
  )
    .bind(user.id)
    .all();
  return c.json({ webhooks: results });
});

// ── POST /api/webhooks — create a webhook ─────────────────────────────

const createWebhookSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url(),
  type: z.enum(["generic", "slack", "discord"]).optional().default("generic"),
  events: z.string().optional().default("all"),
  secret: z.string().optional(),
});

app.post("/api/webhooks", zValidator("json", createWebhookSchema), async (c) => {
  const user = c.get("user");
  const body = c.req.valid("json");

  const secret = body.secret || generateSecret();

  const result = await c.env.DB.prepare(
    "INSERT INTO webhooks (user_id, name, url, secret, type, events) VALUES (?, ?, ?, ?, ?, ?) RETURNING id, name, url, type, events, active, created_at"
  )
    .bind(user.id, body.name, body.url, secret, body.type, body.events)
    .first();

  return c.json({ ...result, secret }, 201);
});

// ── DELETE /api/webhooks/:id — delete with ownership check ────────────

app.delete("/api/webhooks/:id", async (c) => {
  const user = c.get("user");
  const webhookId = Number(c.req.param("id"));

  if (isNaN(webhookId)) {
    return c.json({ error: "Invalid webhook id" }, 400);
  }

  const existing = await c.env.DB.prepare(
    "SELECT id FROM webhooks WHERE id = ? AND user_id = ?"
  )
    .bind(webhookId, user.id)
    .first();

  if (!existing) {
    return c.json({ error: "Webhook not found" }, 404);
  }

  await c.env.DB.prepare("DELETE FROM webhooks WHERE id = ?")
    .bind(webhookId)
    .run();

  return c.json({ ok: true });
});

// ── POST /api/webhooks/:id/test — send a test event ──────────────────

app.post("/api/webhooks/:id/test", async (c) => {
  const user = c.get("user");
  const webhookId = Number(c.req.param("id"));

  if (isNaN(webhookId)) {
    return c.json({ error: "Invalid webhook id" }, 400);
  }

  const webhook = await c.env.DB.prepare(
    "SELECT * FROM webhooks WHERE id = ? AND user_id = ?"
  )
    .bind(webhookId, user.id)
    .first<{ id: number; url: string; secret: string; type: string }>();

  if (!webhook) {
    return c.json({ error: "Webhook not found" }, 404);
  }

  const appUrl = c.env.APP_URL || "https://gatecode.dev";

  const testData = {
    agent_id: "test-agent",
    repo: "example/repo",
    scope: "write",
    reason: "This is a test notification from GateCode",
    approveUrl: `${appUrl}/dashboard`,
    denyUrl: `${appUrl}/dashboard`,
  };

  let success = false;

  if (webhook.type === "slack") {
    success = await sendSlackNotification(webhook.url, "test", testData);
  } else if (webhook.type === "discord") {
    success = await sendDiscordNotification(webhook.url, "test", testData);
  } else {
    success = await sendWebhook(webhook.url, webhook.secret, "test", {
      event: "test",
      ...testData,
      timestamp: new Date().toISOString(),
    });
  }

  return c.json({ success });
});

export default app;

// GateCode — API key management routes

import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type { Env } from "../types";
import { authMiddleware } from "../middleware/auth";
import {
  createApiKey,
  listApiKeys,
  deleteApiKey,
} from "../db/queries";

const app = new Hono<Env>();

// All routes require authentication
app.use("/api/keys/*", authMiddleware);
app.use("/api/keys", authMiddleware);

// ── Helper: hash a key with SHA-256 ────────────────────────────────────

async function hashKey(key: string): Promise<string> {
  const encoded = new TextEncoder().encode(key);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── GET /api/keys — list user's API keys ───────────────────────────────

app.get("/api/keys", async (c) => {
  const user = c.get("user");
  const keys = await listApiKeys(c.env.DB, user.id);
  return c.json({ keys });
});

// ── POST /api/keys — create a new API key ──────────────────────────────

const createKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.string().optional(),
});

app.post("/api/keys", zValidator("json", createKeySchema), async (c) => {
  const user = c.get("user");
  const body = c.req.valid("json");

  // Generate random key: gk_ + 32 hex chars (16 random bytes)
  const randomBytes = new Uint8Array(16);
  crypto.getRandomValues(randomBytes);
  const hexChars = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const rawKey = `gk_${hexChars}`;
  const keyPrefix = rawKey.slice(0, 7); // "gk_" + first 4 hex chars
  const keyHash = await hashKey(rawKey);

  const apiKey = await createApiKey(c.env.DB, {
    user_id: user.id,
    name: body.name,
    key_hash: keyHash,
    key_prefix: keyPrefix,
    scopes: body.scopes ?? "request",
  });

  // Return the full key ONCE — it cannot be retrieved again
  return c.json({
    id: apiKey.id,
    name: apiKey.name,
    key: rawKey,
    key_prefix: apiKey.key_prefix,
    scopes: apiKey.scopes,
    created_at: apiKey.created_at,
  }, 201);
});

// ── DELETE /api/keys/:id — delete an API key ───────────────────────────

app.delete("/api/keys/:id", async (c) => {
  const user = c.get("user");
  const keyId = Number(c.req.param("id"));

  if (isNaN(keyId)) {
    return c.json({ error: "Invalid key id" }, 400);
  }

  const deleted = await deleteApiKey(c.env.DB, keyId, user.id);
  if (!deleted) {
    return c.json({ error: "API key not found" }, 404);
  }

  return c.json({ ok: true });
});

export default app;

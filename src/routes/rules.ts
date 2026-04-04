// GateCode — Rule management routes

import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import type { Env } from "../types";
import { authMiddleware } from "../middleware/auth";
import { getRules, createRule, deleteRule } from "../db/queries";

const app = new Hono<Env>();

// All routes require authentication
app.use("/*", authMiddleware);

// ── GET /api/rules — List rules for authenticated user ──────────────────

app.get("/api/rules", async (c) => {
  const user = c.get("user");
  const rules = await getRules(c.env.DB, Number(user.id));
  return c.json(rules);
});

// ── POST /api/rules — Create a new rule ─────────────────────────────────

const createRuleSchema = z.object({
  pattern: z.string().min(1, "Pattern is required"),
  scope: z.enum(["read", "write"]),
  action: z.enum(["auto_approve", "auto_deny", "ask"]),
});

app.post("/api/rules", zValidator("json", createRuleSchema), async (c) => {
  const user = c.get("user");

  // Free plan users cannot create rules
  if (user.plan === "free") {
    return c.json(
      {
        error:
          "Rules are not available on the free plan. Please upgrade to create auto-approve/deny rules.",
      },
      403
    );
  }

  const body = c.req.valid("json");

  const rule = await createRule(c.env.DB, {
    user_id: Number(user.id),
    pattern: body.pattern,
    scope: body.scope,
    action: body.action,
  });

  return c.json(rule, 201);
});

// ── DELETE /api/rules/:id — Delete a rule ───────────────────────────────

app.delete("/api/rules/:id", async (c) => {
  const user = c.get("user");
  const ruleId = Number(c.req.param("id"));

  if (isNaN(ruleId)) {
    return c.json({ error: "Invalid rule id" }, 400);
  }

  const deleted = await deleteRule(c.env.DB, ruleId, Number(user.id));
  if (!deleted) {
    return c.json({ error: "Rule not found or not owned by you" }, 404);
  }

  return c.body(null, 204);
});

export default app;

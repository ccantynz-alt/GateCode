// GateCode — Audit log routes

import { Hono } from "hono";
import type { Env } from "../types";
import { authMiddleware } from "../middleware/auth";
import type { AuditEntry } from "../db/queries";

const app = new Hono<Env>();

// All routes require authentication
app.use("/*", authMiddleware);

// ── GET /api/audit — Query audit log with filters and pagination ────────

app.get("/api/audit", async (c) => {
  const user = c.get("user");
  const userId = Number(user.id);

  // Parse and clamp query params
  let limit = Math.min(Number(c.req.query("limit") ?? "50"), 100);
  if (isNaN(limit) || limit < 1) limit = 50;

  let offset = Number(c.req.query("offset") ?? "0");
  if (isNaN(offset) || offset < 0) offset = 0;

  const repoFilter = c.req.query("repo") ?? null;
  const agentFilter = c.req.query("agent_id") ?? null;

  // Build dynamic query
  const conditions: string[] = ["user_id = ?"];
  const bindings: (string | number)[] = [userId];

  if (repoFilter) {
    conditions.push("repo = ?");
    bindings.push(repoFilter);
  }
  if (agentFilter) {
    conditions.push("agent_id = ?");
    bindings.push(agentFilter);
  }

  const where = conditions.join(" AND ");

  // Get total count for pagination metadata
  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM audit_log WHERE ${where}`
  )
    .bind(...bindings)
    .first<{ total: number }>();
  const total = countRow?.total ?? 0;

  // Fetch page
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM audit_log WHERE ${where} ORDER BY timestamp DESC LIMIT ? OFFSET ?`
  )
    .bind(...bindings, limit, offset)
    .all<AuditEntry>();

  return c.json({
    data: results,
    pagination: {
      total,
      limit,
      offset,
    },
  });
});

export default app;

// GateCode — OAuth-style permission gateway for AI coding agents
// Entry point: Hono app on Cloudflare Workers

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import type { Env } from "./types";
import authRoutes from "./routes/auth";
import requestRoutes from "./routes/requests";
import rulesRoutes from "./routes/rules";
import auditRoutes from "./routes/audit";
import apikeysRoutes from "./routes/apikeys";
import billingRoutes from "./routes/billing";
import webhookRoutes from "./routes/webhooks";
import mcpRoutes from "./routes/mcp";
import { landingPage } from "./pages/landing";
import { dashboardPage } from "./pages/dashboard";
import { docsPage } from "./pages/docs";
import { authMiddleware } from "./middleware/auth";

const app = new Hono<Env>();

// Global middleware
app.use("*", cors());
app.use("*", logger());
app.use("*", secureHeaders());

// Health check
app.get("/health", (c) =>
  c.json({ status: "ok", service: "gatecode", version: "0.1.0" })
);

// Public pages
app.get("/", landingPage);
app.get("/docs", docsPage);

// Dashboard (auth required)
app.get("/dashboard", authMiddleware, dashboardPage);

// Auth routes
app.route("/", authRoutes);

// API routes
app.route("/", requestRoutes);
app.route("/", rulesRoutes);
app.route("/", auditRoutes);
app.route("/", apikeysRoutes);
app.route("/", billingRoutes);
app.route("/", webhookRoutes);
app.route("/", mcpRoutes);

// 404 handler
app.notFound((c) => {
  const accept = c.req.header("Accept") ?? "";
  if (accept.includes("text/html")) {
    return c.html(
      `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>404 — GateCode</title>
<style>body{background:#0a0a0f;color:#e2e2f0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}
.c{text-align:center;}.c h1{font-size:6rem;font-weight:800;background:linear-gradient(135deg,#3b82f6,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin:0;}
.c p{color:#8888a0;font-size:1.1rem;margin:1rem 0 2rem;}
.c a{color:#3b82f6;text-decoration:none;font-weight:600;padding:.75rem 1.5rem;border:1px solid #1e1e2e;border-radius:8px;transition:border-color .2s;}
.c a:hover{border-color:#3b82f6;}</style></head>
<body><div class="c"><h1>404</h1><p>This page doesn't exist.</p><a href="/">Back to GateCode</a></div></body></html>`,
      404
    );
  }
  return c.json({ error: "Not found" }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  const accept = c.req.header("Accept") ?? "";
  if (accept.includes("text/html")) {
    return c.html(
      `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Error — GateCode</title>
<style>body{background:#0a0a0f;color:#e2e2f0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}
.c{text-align:center;}.c h1{font-size:4rem;font-weight:800;color:#ef4444;margin:0;}
.c p{color:#8888a0;font-size:1.1rem;margin:1rem 0 2rem;}
.c a{color:#3b82f6;text-decoration:none;font-weight:600;}</style></head>
<body><div class="c"><h1>500</h1><p>Something went wrong. We're on it.</p><a href="/">Back to GateCode</a></div></body></html>`,
      500
    );
  }
  return c.json({ error: "Internal server error" }, 500);
});

export default app;

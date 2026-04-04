// GateCode — OAuth-style permission gateway for AI coding agents
// Entry point: Hono app on Cloudflare Workers

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { Env } from "./types";
import authRoutes from "./routes/auth";
import requestRoutes from "./routes/requests";
import rulesRoutes from "./routes/rules";
import auditRoutes from "./routes/audit";
import apikeysRoutes from "./routes/apikeys";
import { landingPage } from "./pages/landing";
import { dashboardPage } from "./pages/dashboard";
import { authMiddleware } from "./middleware/auth";

const app = new Hono<Env>();

// Global middleware
app.use("*", cors());
app.use("*", logger());

// Health check
app.get("/health", (c) => c.json({ status: "ok", service: "gatecode" }));

// Public pages
app.get("/", landingPage);

// Dashboard (auth required)
app.get("/dashboard", authMiddleware, dashboardPage);

// Auth routes
app.route("/", authRoutes);

// API routes
app.route("/", requestRoutes);
app.route("/", rulesRoutes);
app.route("/", auditRoutes);
app.route("/", apikeysRoutes);

export default app;

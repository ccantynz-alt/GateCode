import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";

// ---------------------------------------------------------------------------
// We test the status endpoint logic by building a small Hono app that mirrors
// the real GET /api/status/:id handler, but uses an in-memory store instead
// of D1. This lets us exercise every code path without mocking Cloudflare
// bindings.
// ---------------------------------------------------------------------------

interface Permission {
  id: number;
  user_id: number;
  agent_id: string;
  repo: string;
  scope: "read" | "write";
  status: "pending" | "approved" | "denied";
  token: string | null;
  expires_at: string | null;
  reason: string | null;
  created_at: string;
}

// In-memory permissions store, reset before each test
let permissions: Permission[] = [];

function getPermissionById(id: number): Permission | undefined {
  return permissions.find((p) => p.id === id);
}

/** Determine whether an approved token has expired. */
function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

// Build a minimal Hono app that replicates the status route logic
const app = new Hono();

app.get("/api/status/:id", async (c) => {
  const permId = Number(c.req.param("id"));

  if (isNaN(permId)) {
    return c.json({ error: "Invalid permission id" }, 400);
  }

  const perm = getPermissionById(permId);
  if (!perm) {
    return c.json({ error: "Permission not found" }, 404);
  }

  // Detect expired tokens
  if (perm.status === "approved" && isExpired(perm.expires_at)) {
    return c.json({
      id: perm.id,
      status: "expired",
    });
  }

  if (perm.status === "approved") {
    return c.json({
      id: perm.id,
      status: perm.status,
      token: perm.token,
      expires_at: perm.expires_at,
    });
  }

  // Pending or denied — include context fields for pending
  if (perm.status === "pending") {
    return c.json({
      id: perm.id,
      status: perm.status,
      repo: perm.repo,
      scope: perm.scope,
      agent_id: perm.agent_id,
      reason: perm.reason,
      created_at: perm.created_at,
    });
  }

  return c.json({
    id: perm.id,
    status: perm.status,
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/status/:id", () => {
  beforeEach(() => {
    permissions = [];
  });

  it("returns 400 for an invalid (non-numeric) ID", async () => {
    const res = await app.request("/api/status/abc");
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe("Invalid permission id");
  });

  it("returns 404 for a non-existent permission", async () => {
    const res = await app.request("/api/status/999");
    expect(res.status).toBe(404);
    const body = await res.json() as Record<string, unknown>;
    expect(body.error).toBe("Permission not found");
  });

  it("returns full context fields for a pending request", async () => {
    permissions.push({
      id: 1,
      user_id: 10,
      agent_id: "agent-42",
      repo: "acme/widgets",
      scope: "read",
      status: "pending",
      token: null,
      expires_at: null,
      reason: "Need to read CI config",
      created_at: "2026-01-01T00:00:00Z",
    });

    const res = await app.request("/api/status/1");
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;

    expect(body).toEqual({
      id: 1,
      status: "pending",
      repo: "acme/widgets",
      scope: "read",
      agent_id: "agent-42",
      reason: "Need to read CI config",
      created_at: "2026-01-01T00:00:00Z",
    });
  });

  it("returns token and expires_at for an approved request", async () => {
    const futureDate = new Date(Date.now() + 3600_000).toISOString();

    permissions.push({
      id: 2,
      user_id: 10,
      agent_id: "agent-42",
      repo: "acme/widgets",
      scope: "write",
      status: "approved",
      token: "ghp_test_token_123",
      expires_at: futureDate,
      reason: null,
      created_at: "2026-01-01T00:00:00Z",
    });

    const res = await app.request("/api/status/2");
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;

    expect(body.status).toBe("approved");
    expect(body.token).toBe("ghp_test_token_123");
    expect(body.expires_at).toBe(futureDate);
  });

  it("returns 'expired' status when the token has expired", async () => {
    const pastDate = new Date(Date.now() - 3600_000).toISOString();

    permissions.push({
      id: 3,
      user_id: 10,
      agent_id: "agent-42",
      repo: "acme/widgets",
      scope: "read",
      status: "approved",
      token: "ghp_expired_token",
      expires_at: pastDate,
      reason: null,
      created_at: "2026-01-01T00:00:00Z",
    });

    const res = await app.request("/api/status/3");
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;

    expect(body.status).toBe("expired");
  });

  it("does NOT return the token when the permission has expired", async () => {
    const pastDate = new Date(Date.now() - 3600_000).toISOString();

    permissions.push({
      id: 4,
      user_id: 10,
      agent_id: "agent-42",
      repo: "acme/widgets",
      scope: "read",
      status: "approved",
      token: "ghp_should_not_see_this",
      expires_at: pastDate,
      reason: null,
      created_at: "2026-01-01T00:00:00Z",
    });

    const res = await app.request("/api/status/4");
    const body = await res.json() as Record<string, unknown>;

    expect(body.token).toBeUndefined();
    expect(body.expires_at).toBeUndefined();
  });
});

// GateCode — Authentication and authorization tests

import { describe, test, expect } from "bun:test";
import {
  appRequest,
  createMockBindings,
  createMockKV,
  createAuthSession,
  mockUser,
} from "./helpers";

describe("Auth-protected routes without session", () => {
  test("GET /dashboard returns 401 without auth", async () => {
    const res = await appRequest("GET", "/dashboard");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  test("GET /api/rules returns 401 without auth", async () => {
    const res = await appRequest("GET", "/api/rules");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  test("POST /api/approve/1 returns 401 without auth", async () => {
    const res = await appRequest("POST", "/api/approve/1");
    expect(res.status).toBe(401);
  });

  test("POST /api/deny/1 returns 401 without auth", async () => {
    const res = await appRequest("POST", "/api/deny/1");
    expect(res.status).toBe(401);
  });

  test("GET /api/audit returns 401 without auth", async () => {
    const res = await appRequest("GET", "/api/audit");
    expect(res.status).toBe(401);
  });

  test("GET /api/keys returns 401 without auth", async () => {
    const res = await appRequest("GET", "/api/keys");
    expect(res.status).toBe(401);
  });
});

describe("Auth-protected routes with valid session", () => {
  test("GET /api/rules returns 200 with valid session", async () => {
    const kv = createMockKV();
    const bindings = createMockBindings({ kv });
    const token = await createAuthSession(kv, mockUser);

    const res = await appRequest("GET", "/api/rules", {
      headers: { Cookie: `session=${token}` },
      bindings,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    // Mock DB returns empty rules array
    expect(Array.isArray(body)).toBe(true);
  });

  test("GET /api/audit returns 200 with valid session", async () => {
    const kv = createMockKV();
    const bindings = createMockBindings({ kv });
    const token = await createAuthSession(kv, mockUser);

    const res = await appRequest("GET", "/api/audit", {
      headers: { Cookie: `session=${token}` },
      bindings,
    });

    expect(res.status).toBe(200);
  });

  test("GET /api/keys returns 200 with valid session", async () => {
    const kv = createMockKV();
    const bindings = createMockBindings({ kv });
    const token = await createAuthSession(kv, mockUser);

    const res = await appRequest("GET", "/api/keys", {
      headers: { Cookie: `session=${token}` },
      bindings,
    });

    expect(res.status).toBe(200);
  });

  test("Bearer token auth also works", async () => {
    const kv = createMockKV();
    const bindings = createMockBindings({ kv });
    const token = await createAuthSession(kv, mockUser);

    const res = await appRequest("GET", "/api/rules", {
      headers: { Authorization: `Bearer ${token}` },
      bindings,
    });

    expect(res.status).toBe(200);
  });
});

describe("POST /auth/logout", () => {
  test("clears session and redirects", async () => {
    const kv = createMockKV();
    const bindings = createMockBindings({ kv });
    const token = await createAuthSession(kv, mockUser);

    const res = await appRequest("POST", "/auth/logout", {
      headers: { Cookie: `session=${token}` },
      bindings,
    });

    // Logout redirects to /
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/");

    // Session should be deleted from KV
    const sessionData = await kv.get(token);
    expect(sessionData).toBeNull();
  });

  test("clears cookie via Set-Cookie header", async () => {
    const kv = createMockKV();
    const bindings = createMockBindings({ kv });
    const token = await createAuthSession(kv, mockUser);

    const res = await appRequest("POST", "/auth/logout", {
      headers: { Cookie: `session=${token}` },
      bindings,
    });

    const setCookie = res.headers.get("Set-Cookie");
    expect(setCookie).toContain("Max-Age=0");
  });
});

describe("Expired/invalid session", () => {
  test("returns 401 with expired session token", async () => {
    const kv = createMockKV();
    const bindings = createMockBindings({ kv });
    // Use a token that does not exist in KV
    const res = await appRequest("GET", "/api/rules", {
      headers: { Cookie: "session=nonexistent-token" },
      bindings,
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain("expired");
  });

  test("returns 401 with corrupt session data", async () => {
    const kv = createMockKV();
    const bindings = createMockBindings({ kv });
    // Put invalid JSON in KV
    await kv.put("bad-token", "not-valid-json{{{");

    const res = await appRequest("GET", "/api/rules", {
      headers: { Cookie: "session=bad-token" },
      bindings,
    });

    expect(res.status).toBe(401);
  });
});

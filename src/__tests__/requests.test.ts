// GateCode — Permission request and status endpoint tests

import { describe, test, expect } from "bun:test";
import { appRequest, createMockBindings, createMockKV, createMockDB } from "./helpers";

describe("POST /api/request", () => {
  test("returns 200 with id and status for valid body", async () => {
    const bindings = createMockBindings();
    const res = await appRequest("POST", "/api/request", {
      body: {
        agent_id: "agent-1",
        repo: "owner/repo",
        scope: "read",
        reason: "Need to read code",
        user_id: 1,
      },
      bindings,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("id");
    expect(body).toHaveProperty("status");
    expect(body.status).toBe("pending");
  });

  test("returns 400 when agent_id is missing", async () => {
    const res = await appRequest("POST", "/api/request", {
      body: {
        repo: "owner/repo",
        scope: "read",
      },
    });

    expect(res.status).toBe(400);
  });

  test("returns 400 when repo is missing", async () => {
    const res = await appRequest("POST", "/api/request", {
      body: {
        agent_id: "agent-1",
        scope: "read",
      },
    });

    expect(res.status).toBe(400);
  });

  test("returns 400 when scope is invalid", async () => {
    const res = await appRequest("POST", "/api/request", {
      body: {
        agent_id: "agent-1",
        repo: "owner/repo",
        scope: "admin",
      },
    });

    expect(res.status).toBe(400);
  });

  test("returns 400 when neither user_id nor username is provided", async () => {
    const res = await appRequest("POST", "/api/request", {
      body: {
        agent_id: "agent-1",
        repo: "owner/repo",
        scope: "read",
      },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("user_id or username");
  });
});

describe("GET /api/status/:id", () => {
  test("returns permission status for valid id", async () => {
    const res = await appRequest("GET", "/api/status/1");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("id");
    expect(body).toHaveProperty("status");
    expect(body.id).toBe(1);
    expect(body.status).toBe("pending");
  });

  test("returns 404 for non-existent permission", async () => {
    const res = await appRequest("GET", "/api/status/999");

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Permission not found");
  });

  test("returns 400 for invalid id", async () => {
    const res = await appRequest("GET", "/api/status/abc");

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid permission id");
  });
});

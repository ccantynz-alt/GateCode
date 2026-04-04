// GateCode — MCP (Model Context Protocol) endpoint tests

import { describe, test, expect } from "bun:test";
import { appRequest, createMockBindings, createMockKV } from "./helpers";

describe("GET /.well-known/oauth-authorization-server", () => {
  test("returns valid OAuth metadata", async () => {
    const bindings = createMockBindings();
    const res = await appRequest(
      "GET",
      "/.well-known/oauth-authorization-server",
      { bindings }
    );

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.issuer).toBe("http://localhost:8787");
    expect(body.authorization_endpoint).toBe(
      "http://localhost:8787/mcp/authorize"
    );
    expect(body.token_endpoint).toBe("http://localhost:8787/mcp/token");
    expect(body.registration_endpoint).toBe(
      "http://localhost:8787/mcp/register"
    );
    expect(body.scopes_supported).toContain("repo:read");
    expect(body.scopes_supported).toContain("repo:write");
    expect(body.response_types_supported).toContain("code");
    expect(body.grant_types_supported).toContain("authorization_code");
    expect(body.code_challenge_methods_supported).toContain("S256");
  });

  test("is a public endpoint (no auth required)", async () => {
    const res = await appRequest(
      "GET",
      "/.well-known/oauth-authorization-server"
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("issuer");
  });
});

describe("POST /mcp/register", () => {
  test("creates a client with valid metadata", async () => {
    const kv = createMockKV();
    const bindings = createMockBindings({ kv });

    const res = await appRequest("POST", "/mcp/register", {
      body: {
        client_name: "Test Agent",
        redirect_uris: ["http://localhost:3000/callback"],
      },
      bindings,
    });

    expect(res.status).toBe(201);
    const body = await res.json();

    expect(body).toHaveProperty("client_id");
    expect(body).toHaveProperty("client_secret");
    expect(body.client_name).toBe("Test Agent");
    expect(body.redirect_uris).toEqual(["http://localhost:3000/callback"]);

    // Verify client was stored in KV
    const stored = await kv.get(`mcp_client:${body.client_id}`);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.client_name).toBe("Test Agent");
  });

  test("returns 400 when client_name is missing", async () => {
    const res = await appRequest("POST", "/mcp/register", {
      body: {
        redirect_uris: ["http://localhost:3000/callback"],
      },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_client_metadata");
  });

  test("returns 400 when redirect_uris is missing", async () => {
    const res = await appRequest("POST", "/mcp/register", {
      body: {
        client_name: "Test Agent",
      },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_client_metadata");
  });

  test("returns 400 when redirect_uris is empty", async () => {
    const res = await appRequest("POST", "/mcp/register", {
      body: {
        client_name: "Test Agent",
        redirect_uris: [],
      },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_client_metadata");
  });

  test("returns 400 for invalid JSON body", async () => {
    const bindings = createMockBindings();
    const app = require("../index").default;
    const { createMockExecutionCtx } = require("./helpers");

    const res = await app.request(
      "http://localhost/mcp/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json{{{",
      },
      bindings,
      createMockExecutionCtx()
    );

    expect(res.status).toBe(400);
  });
});

describe("GET /mcp/tools", () => {
  test("returns tool list", async () => {
    const res = await appRequest("GET", "/mcp/tools");

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body).toHaveProperty("tools");
    expect(Array.isArray(body.tools)).toBe(true);
    expect(body.tools.length).toBeGreaterThan(0);

    // Verify expected tools exist
    const toolNames = body.tools.map((t: { name: string }) => t.name);
    expect(toolNames).toContain("request_repo_access");
    expect(toolNames).toContain("check_access_status");
    expect(toolNames).toContain("list_approved_repos");
  });

  test("each tool has required fields", async () => {
    const res = await appRequest("GET", "/mcp/tools");
    const body = await res.json();

    for (const tool of body.tools) {
      expect(tool).toHaveProperty("name");
      expect(tool).toHaveProperty("description");
      expect(tool).toHaveProperty("inputSchema");
      expect(tool.inputSchema).toHaveProperty("type", "object");
      expect(tool.inputSchema).toHaveProperty("properties");
    }
  });
});

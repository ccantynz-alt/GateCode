// GateCode — MCP (Model Context Protocol) server routes
// Implements OAuth 2.1 authorization server + MCP tool execution

import { Hono } from "hono";
import type { Env } from "../types";
import type { User, Permission } from "../db/queries";
import {
  createPermission,
  getPermissionById,
  getUserById,
} from "../db/queries";
import { consentPage } from "../pages/consent";

const mcp = new Hono<Env>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Base64-url encode a buffer (no padding). */
function base64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Parse session cookie and return { userId, githubToken } or null. */
async function getSession(
  c: { req: { header(name: string): string | undefined }; env: { SESSIONS: KVNamespace; DB: D1Database } }
): Promise<{ userId: number; githubToken: string; user: User } | null> {
  const cookie = c.req.header("Cookie");
  if (!cookie) return null;

  const match = cookie.match(/(?:^|;\s*)session=([^\s;]+)/);
  if (!match) return null;

  const sessionData = await c.env.SESSIONS.get(match[1]);
  if (!sessionData) return null;

  let parsed: { userId: number; githubToken: string };
  try {
    parsed = JSON.parse(sessionData);
  } catch {
    return null;
  }

  const user = await getUserById(c.env.DB, parsed.userId);
  if (!user) return null;

  return { userId: parsed.userId, githubToken: parsed.githubToken, user };
}

/** Validate a Bearer token from Authorization header against KV. Returns the user or null. */
async function validateBearerToken(
  c: { req: { header(name: string): string | undefined }; env: { SESSIONS: KVNamespace; DB: D1Database } }
): Promise<{ userId: number; user: User; scope: string } | null> {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  const data = await c.env.SESSIONS.get(`mcp_token:${token}`);
  if (!data) return null;

  let parsed: { userId: number; scope: string };
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }

  const user = await getUserById(c.env.DB, parsed.userId);
  if (!user) return null;

  return { userId: parsed.userId, user, scope: parsed.scope };
}

// ---------------------------------------------------------------------------
// OAuth 2.1 Metadata Discovery
// ---------------------------------------------------------------------------

mcp.get("/.well-known/oauth-authorization-server", (c) => {
  const base = c.env.APP_URL;
  return c.json({
    issuer: base,
    authorization_endpoint: `${base}/mcp/authorize`,
    token_endpoint: `${base}/mcp/token`,
    registration_endpoint: `${base}/mcp/register`,
    scopes_supported: ["repo:read", "repo:write"],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    revocation_endpoint: `${base}/mcp/revoke`,
  });
});

// ---------------------------------------------------------------------------
// Dynamic Client Registration (RFC 7591)
// ---------------------------------------------------------------------------

mcp.post("/mcp/register", async (c) => {
  let body: {
    client_name?: string;
    redirect_uris?: string[];
    grant_types?: string[];
    scope?: string;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_request", error_description: "Invalid JSON body" }, 400);
  }

  if (!body.client_name || !body.redirect_uris || body.redirect_uris.length === 0) {
    return c.json(
      { error: "invalid_client_metadata", error_description: "client_name and redirect_uris are required" },
      400
    );
  }

  const clientId = crypto.randomUUID();
  const clientSecret = crypto.randomUUID();

  const clientData = {
    client_id: clientId,
    client_secret: clientSecret,
    client_name: body.client_name,
    redirect_uris: body.redirect_uris,
    grant_types: body.grant_types ?? ["authorization_code"],
    scope: body.scope ?? "repo:read",
  };

  // Store in KV (no expiration — clients persist)
  await c.env.SESSIONS.put(`mcp_client:${clientId}`, JSON.stringify(clientData));

  return c.json({
    client_id: clientId,
    client_secret: clientSecret,
    client_name: body.client_name,
    redirect_uris: body.redirect_uris,
  }, 201);
});

// ---------------------------------------------------------------------------
// Authorization Endpoint
// ---------------------------------------------------------------------------

mcp.get("/mcp/authorize", async (c) => {
  const clientId = c.req.query("client_id");
  const redirectUri = c.req.query("redirect_uri");
  const state = c.req.query("state");
  const scope = c.req.query("scope") ?? "repo:read";
  const codeChallenge = c.req.query("code_challenge");
  const codeChallengeMethod = c.req.query("code_challenge_method");
  const responseType = c.req.query("response_type");

  if (!clientId || !redirectUri || !codeChallenge || responseType !== "code") {
    return c.json(
      { error: "invalid_request", error_description: "Missing required parameters: client_id, redirect_uri, code_challenge, response_type=code" },
      400
    );
  }

  if (codeChallengeMethod && codeChallengeMethod !== "S256") {
    return c.json(
      { error: "invalid_request", error_description: "Only S256 code_challenge_method is supported" },
      400
    );
  }

  // Validate client
  const clientRaw = await c.env.SESSIONS.get(`mcp_client:${clientId}`);
  if (!clientRaw) {
    return c.json({ error: "invalid_client", error_description: "Unknown client_id" }, 400);
  }

  const client = JSON.parse(clientRaw) as {
    client_name: string;
    redirect_uris: string[];
  };

  if (!client.redirect_uris.includes(redirectUri)) {
    return c.json({ error: "invalid_request", error_description: "redirect_uri not registered" }, 400);
  }

  // Check if user is logged in
  const session = await getSession(c);
  if (!session) {
    // Redirect to GitHub login, then back here
    const returnUrl = `${c.env.APP_URL}/mcp/authorize?${new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      ...(state ? { state } : {}),
      scope,
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod ?? "S256",
      response_type: "code",
    }).toString()}`;

    // Store the return URL in KV so we can redirect back after login
    const loginState = crypto.randomUUID();
    await c.env.SESSIONS.put(`mcp_return:${loginState}`, returnUrl, {
      expirationTtl: 600,
    });

    // Redirect to GitHub OAuth with state that encodes the return
    const params = new URLSearchParams({
      client_id: c.env.GITHUB_CLIENT_ID,
      redirect_uri: `${c.env.APP_URL}/auth/callback`,
      scope: "repo,read:user,user:email",
      state: loginState,
    });

    return c.redirect(`https://github.com/login/oauth/authorize?${params}`);
  }

  // User is logged in — show consent page
  const scopes = scope.split(/[\s,]+/).filter(Boolean);

  // Store authorization request params in KV so POST handler can retrieve them
  const authRequestId = crypto.randomUUID();
  await c.env.SESSIONS.put(
    `mcp_authreq:${authRequestId}`,
    JSON.stringify({
      clientId,
      redirectUri,
      state: state ?? null,
      scope,
      codeChallenge,
      codeChallengeMethod: codeChallengeMethod ?? "S256",
      userId: session.userId,
    }),
    { expirationTtl: 600 }
  );

  const html = consentPage({
    clientName: client.client_name,
    scopes,
    authorizeUrl: `${c.env.APP_URL}/mcp/authorize/approve?auth_request=${authRequestId}`,
    denyUrl: `${redirectUri}?error=access_denied${state ? `&state=${encodeURIComponent(state)}` : ""}`,
  });

  return c.html(html);
});

// POST /mcp/authorize/approve — Handle consent approval
mcp.post("/mcp/authorize/approve", async (c) => {
  const authRequestId = c.req.query("auth_request");
  if (!authRequestId) {
    return c.json({ error: "invalid_request" }, 400);
  }

  const reqDataRaw = await c.env.SESSIONS.get(`mcp_authreq:${authRequestId}`);
  if (!reqDataRaw) {
    return c.json({ error: "invalid_request", error_description: "Authorization request expired" }, 400);
  }

  // Clean up the auth request
  await c.env.SESSIONS.delete(`mcp_authreq:${authRequestId}`);

  const reqData = JSON.parse(reqDataRaw) as {
    clientId: string;
    redirectUri: string;
    state: string | null;
    scope: string;
    codeChallenge: string;
    codeChallengeMethod: string;
    userId: number;
  };

  // Verify the user is still logged in and is the same user
  const session = await getSession(c);
  if (!session || session.userId !== reqData.userId) {
    return c.json({ error: "access_denied", error_description: "Session mismatch" }, 403);
  }

  // Generate authorization code
  const code = crypto.randomUUID();
  await c.env.SESSIONS.put(
    `mcp_code:${code}`,
    JSON.stringify({
      clientId: reqData.clientId,
      redirectUri: reqData.redirectUri,
      scope: reqData.scope,
      codeChallenge: reqData.codeChallenge,
      codeChallengeMethod: reqData.codeChallengeMethod,
      userId: reqData.userId,
    }),
    { expirationTtl: 300 } // 5 minute TTL
  );

  const redirectUrl = new URL(reqData.redirectUri);
  redirectUrl.searchParams.set("code", code);
  if (reqData.state) {
    redirectUrl.searchParams.set("state", reqData.state);
  }

  return c.redirect(redirectUrl.toString());
});

// ---------------------------------------------------------------------------
// Token Exchange Endpoint
// ---------------------------------------------------------------------------

mcp.post("/mcp/token", async (c) => {
  const contentType = c.req.header("Content-Type") ?? "";

  let grantType: string | undefined;
  let code: string | undefined;
  let redirectUri: string | undefined;
  let clientId: string | undefined;
  let codeVerifier: string | undefined;

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const body = await c.req.parseBody();
    grantType = body["grant_type"] as string | undefined;
    code = body["code"] as string | undefined;
    redirectUri = body["redirect_uri"] as string | undefined;
    clientId = body["client_id"] as string | undefined;
    codeVerifier = body["code_verifier"] as string | undefined;
  } else {
    // Also support JSON body
    try {
      const body = await c.req.json<Record<string, string>>();
      grantType = body.grant_type;
      code = body.code;
      redirectUri = body.redirect_uri;
      clientId = body.client_id;
      codeVerifier = body.code_verifier;
    } catch {
      return c.json({ error: "invalid_request", error_description: "Invalid request body" }, 400);
    }
  }

  if (grantType !== "authorization_code") {
    return c.json({ error: "unsupported_grant_type" }, 400);
  }

  if (!code || !redirectUri || !clientId || !codeVerifier) {
    return c.json(
      { error: "invalid_request", error_description: "Missing required parameters: code, redirect_uri, client_id, code_verifier" },
      400
    );
  }

  // Look up the authorization code
  const codeDataRaw = await c.env.SESSIONS.get(`mcp_code:${code}`);
  if (!codeDataRaw) {
    return c.json({ error: "invalid_grant", error_description: "Authorization code expired or invalid" }, 400);
  }

  // Delete the code (single use)
  await c.env.SESSIONS.delete(`mcp_code:${code}`);

  const codeData = JSON.parse(codeDataRaw) as {
    clientId: string;
    redirectUri: string;
    scope: string;
    codeChallenge: string;
    codeChallengeMethod: string;
    userId: number;
  };

  // Verify client_id and redirect_uri match
  if (codeData.clientId !== clientId) {
    return c.json({ error: "invalid_grant", error_description: "client_id mismatch" }, 400);
  }
  if (codeData.redirectUri !== redirectUri) {
    return c.json({ error: "invalid_grant", error_description: "redirect_uri mismatch" }, 400);
  }

  // Verify PKCE: SHA-256(code_verifier) base64url == code_challenge
  const verifierHash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(codeVerifier)
  );
  const computedChallenge = base64url(verifierHash);

  if (computedChallenge !== codeData.codeChallenge) {
    return c.json({ error: "invalid_grant", error_description: "PKCE verification failed" }, 400);
  }

  // Issue access token
  const accessToken = crypto.randomUUID();
  await c.env.SESSIONS.put(
    `mcp_token:${accessToken}`,
    JSON.stringify({
      userId: codeData.userId,
      scope: codeData.scope,
      clientId: codeData.clientId,
    }),
    { expirationTtl: 3600 } // 1 hour
  );

  return c.json({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: 3600,
    scope: codeData.scope,
  });
});

// ---------------------------------------------------------------------------
// Token Revocation
// ---------------------------------------------------------------------------

mcp.post("/mcp/revoke", async (c) => {
  let token: string | undefined;
  try {
    const body = await c.req.json<{ token?: string }>();
    token = body.token;
  } catch {
    return c.json({ error: "invalid_request" }, 400);
  }

  if (token) {
    await c.env.SESSIONS.delete(`mcp_token:${token}`);
  }

  return c.json({}, 200);
});

// ---------------------------------------------------------------------------
// MCP Tools Discovery
// ---------------------------------------------------------------------------

mcp.get("/mcp/tools", (_c) => {
  return _c.json({
    tools: [
      {
        name: "request_repo_access",
        description: "Request access to a GitHub repository",
        inputSchema: {
          type: "object",
          properties: {
            repo: { type: "string", description: "Repository in owner/repo format" },
            scope: { type: "string", enum: ["read", "write"], description: "Access scope" },
            reason: { type: "string", description: "Reason for requesting access" },
          },
          required: ["repo", "scope"],
        },
      },
      {
        name: "check_access_status",
        description: "Check if a permission request was approved",
        inputSchema: {
          type: "object",
          properties: {
            request_id: { type: "number", description: "The permission request ID" },
          },
          required: ["request_id"],
        },
      },
      {
        name: "list_approved_repos",
        description: "List repos the agent currently has access to",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
    ],
  });
});

// ---------------------------------------------------------------------------
// MCP Tool Execution
// ---------------------------------------------------------------------------

mcp.post("/mcp/execute", async (c) => {
  // Validate Bearer token
  const auth = await validateBearerToken(c);
  if (!auth) {
    return c.json({ error: "unauthorized", error_description: "Invalid or missing Bearer token" }, 401);
  }

  let body: { tool?: string; input?: Record<string, unknown> };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_request", error_description: "Invalid JSON body" }, 400);
  }

  if (!body.tool) {
    return c.json({ error: "invalid_request", error_description: "Missing tool name" }, 400);
  }

  const input = body.input ?? {};

  switch (body.tool) {
    // ── request_repo_access ──────────────────────────────────────────
    case "request_repo_access": {
      const repo = input.repo as string | undefined;
      const scope = input.scope as "read" | "write" | undefined;
      const reason = (input.reason as string) ?? null;

      if (!repo || !scope || !["read", "write"].includes(scope)) {
        return c.json({
          error: "invalid_input",
          error_description: "repo (string) and scope (read|write) are required",
        }, 400);
      }

      const permId = await createPermission(c.env.DB, {
        user_id: auth.userId,
        agent_id: `mcp:${auth.user.username}`,
        repo,
        scope,
        reason,
      });

      return c.json({
        result: {
          request_id: permId,
          status: "pending",
          message: `Permission request created. The repository owner must approve access to ${repo}.`,
        },
      });
    }

    // ── check_access_status ──────────────────────────────────────────
    case "check_access_status": {
      const requestId = input.request_id as number | undefined;
      if (!requestId || typeof requestId !== "number") {
        return c.json({
          error: "invalid_input",
          error_description: "request_id (number) is required",
        }, 400);
      }

      const perm = await getPermissionById(c.env.DB, requestId);
      if (!perm) {
        return c.json({
          result: { error: "not_found", message: "Permission request not found" },
        }, 404);
      }

      // Only allow checking own permissions
      if (perm.user_id !== auth.userId) {
        return c.json({
          result: { error: "forbidden", message: "Cannot check another user's permission" },
        }, 403);
      }

      const result: Record<string, unknown> = {
        request_id: perm.id,
        repo: perm.repo,
        scope: perm.scope,
        status: perm.status,
      };

      if (perm.status === "approved") {
        result.token = perm.token;
        result.expires_at = perm.expires_at;
      }

      return c.json({ result });
    }

    // ── list_approved_repos ──────────────────────────────────────────
    case "list_approved_repos": {
      const { results } = await c.env.DB.prepare(
        `SELECT id, repo, scope, token, expires_at, created_at
         FROM permissions
         WHERE user_id = ? AND status = 'approved'
         ORDER BY created_at DESC`
      )
        .bind(auth.userId)
        .all<Pick<Permission, "id" | "repo" | "scope" | "token" | "expires_at" | "created_at">>();

      return c.json({
        result: {
          repos: results.map((p) => ({
            request_id: p.id,
            repo: p.repo,
            scope: p.scope,
            expires_at: p.expires_at,
            created_at: p.created_at,
          })),
        },
      });
    }

    default:
      return c.json({
        error: "unknown_tool",
        error_description: `Unknown tool: ${body.tool}`,
      }, 400);
  }
});

export default mcp;

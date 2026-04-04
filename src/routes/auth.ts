import { Hono } from "hono";
import type { Env } from "../types";
import { exchangeCodeForToken, getGitHubUser } from "../lib/github";

const auth = new Hono<Env>();

// GET /auth/github — Redirect to GitHub OAuth
auth.get("/auth/github", async (c) => {
  const state = crypto.randomUUID();

  // Store state in KV with 10-minute TTL for CSRF protection
  await c.env.SESSIONS.put(`oauth_state:${state}`, "1", {
    expirationTtl: 600,
  });

  const params = new URLSearchParams({
    client_id: c.env.GITHUB_CLIENT_ID,
    redirect_uri: `${c.env.APP_URL}/auth/callback`,
    scope: "repo,read:user,user:email",
    state,
  });

  return c.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

// GET /auth/callback — Handle GitHub OAuth callback
auth.get("/auth/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");

  if (!code || !state) {
    return c.text("Missing code or state parameter", 400);
  }

  // Validate state to prevent CSRF
  const storedState = await c.env.SESSIONS.get(`oauth_state:${state}`);
  if (!storedState) {
    return c.text("Invalid or expired state parameter", 403);
  }

  // Clean up used state
  await c.env.SESSIONS.delete(`oauth_state:${state}`);

  // Exchange code for token
  let accessToken: string;
  try {
    accessToken = await exchangeCodeForToken(
      c.env.GITHUB_CLIENT_ID,
      c.env.GITHUB_CLIENT_SECRET,
      code
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Token exchange failed";
    return c.text(message, 502);
  }

  // Fetch GitHub user profile
  let ghUser: Awaited<ReturnType<typeof getGitHubUser>>;
  try {
    ghUser = await getGitHubUser(accessToken);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch GitHub user";
    return c.text(message, 502);
  }

  // Upsert user in DB (id is INTEGER PRIMARY KEY AUTOINCREMENT)
  await c.env.DB.prepare(
    "INSERT OR IGNORE INTO users (github_id, username, email, avatar_url) VALUES (?, ?, ?, ?)"
  )
    .bind(ghUser.id, ghUser.login, ghUser.email, ghUser.avatar_url)
    .run();

  // Update profile in case it changed
  await c.env.DB.prepare(
    "UPDATE users SET username = ?, email = ?, avatar_url = ? WHERE github_id = ?"
  )
    .bind(ghUser.login, ghUser.email, ghUser.avatar_url, ghUser.id)
    .run();

  const dbUser = await c.env.DB.prepare(
    "SELECT id FROM users WHERE github_id = ?"
  )
    .bind(ghUser.id)
    .first<{ id: number }>();

  const userId = dbUser!.id;

  // Create session in KV (24h TTL)
  const sessionId = crypto.randomUUID();
  const sessionData = JSON.stringify({
    userId,
    githubToken: accessToken,
  });

  await c.env.SESSIONS.put(sessionId, sessionData, {
    expirationTtl: 86400,
  });

  // Set session cookie and redirect to dashboard
  c.header(
    "Set-Cookie",
    `session=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`
  );

  return c.redirect("/dashboard");
});

// POST /auth/logout — Destroy session
auth.post("/auth/logout", async (c) => {
  const cookie = c.req.header("Cookie");
  if (cookie) {
    const match = cookie.match(/(?:^|;\s*)session=([^\s;]+)/);
    if (match) {
      await c.env.SESSIONS.delete(match[1]);
    }
  }

  // Clear cookie by setting it expired
  c.header(
    "Set-Cookie",
    "session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"
  );

  return c.redirect("/");
});

export default auth;

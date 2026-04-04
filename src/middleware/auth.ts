import { createMiddleware } from "hono/factory";
import type { Context } from "hono";
import type { Env, User } from "../types";

export const authMiddleware = createMiddleware<Env>(async (c, next) => {
  const sessionToken = getSessionToken(c);
  if (!sessionToken) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const sessionData = await c.env.SESSIONS.get(sessionToken);
  if (!sessionData) {
    return c.json({ error: "Session expired or invalid" }, 401);
  }

  let parsed: { userId: string; githubToken: string };
  try {
    parsed = JSON.parse(sessionData);
  } catch {
    return c.json({ error: "Corrupt session" }, 401);
  }

  const user = await c.env.DB.prepare(
    "SELECT * FROM users WHERE id = ?"
  )
    .bind(parsed.userId)
    .first<User>();

  if (!user) {
    return c.json({ error: "User not found" }, 401);
  }

  c.set("user", user);
  c.set("githubToken", parsed.githubToken);

  await next();
});

function getSessionToken(c: Context<Env>): string | null {
  // Check cookie first
  const cookie = c.req.header("Cookie");
  if (cookie) {
    const match = cookie.match(/(?:^|;\s*)session=([^\s;]+)/);
    if (match) {
      return match[1];
    }
  }

  // Fall back to Authorization Bearer header
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  return null;
}

export function getSessionUser(c: Context<Env>): User {
  return c.get("user");
}

// GateCode — Rate limiting middleware using Cloudflare KV

import { createMiddleware } from "hono/factory";
import type { Env } from "../types";

export interface RateLimitOptions {
  max: number;
  window: number; // seconds
}

export function rateLimit(opts: RateLimitOptions) {
  return createMiddleware<Env>(async (c, next) => {
    const kv = c.env.SESSIONS;

    // Use user id if authenticated, otherwise fall back to IP
    const user = c.get("user" as never) as { id: number } | undefined;
    const identifier = user
      ? `user:${user.id}`
      : c.req.header("CF-Connecting-IP") ?? "unknown";

    const windowStart = Math.floor(Date.now() / 1000 / opts.window) * opts.window;
    const key = `ratelimit:${identifier}:${windowStart}`;

    const current = await kv.get(key);
    const count = current ? parseInt(current, 10) : 0;

    const resetTime = windowStart + opts.window;

    // Set rate limit headers on all responses
    c.header("X-RateLimit-Limit", String(opts.max));
    c.header("X-RateLimit-Remaining", String(Math.max(0, opts.max - count - 1)));
    c.header("X-RateLimit-Reset", String(resetTime));

    if (count >= opts.max) {
      const retryAfter = resetTime - Math.floor(Date.now() / 1000);
      c.header("Retry-After", String(Math.max(1, retryAfter)));
      return c.json({ error: "Too many requests" }, 429);
    }

    // Increment counter with TTL matching the window
    await kv.put(key, String(count + 1), { expirationTtl: opts.window });

    await next();
  });
}

// GateCode — Test helpers for Hono app testing with mock D1 and KV

import type { User, Permission, Rule, AuditEntry } from "../db/queries";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

export const mockUser: User = {
  id: 1,
  github_id: 12345,
  username: "testuser",
  email: "test@example.com",
  avatar_url: null,
  plan: "free",
  stripe_customer_id: null,
  created_at: "2026-01-01T00:00:00Z",
};

export const mockPermission: Permission = {
  id: 1,
  user_id: 1,
  agent_id: "agent-1",
  repo: "owner/repo",
  scope: "read",
  status: "pending",
  token: null,
  expires_at: null,
  reason: "Need to read code",
  created_at: "2026-01-01T00:00:00Z",
};

// ---------------------------------------------------------------------------
// Mock D1 Statement
// ---------------------------------------------------------------------------

interface MockStatementResult {
  first: unknown;
  all: unknown[];
  run: { meta: { changes: number } };
}

function determineMockResult(
  sql: string,
  boundArgs: unknown[]
): MockStatementResult {
  const sqlLower = sql.toLowerCase();

  // SELECT * FROM users WHERE id = ?
  if (sqlLower.includes("select") && sqlLower.includes("from users")) {
    return {
      first: { ...mockUser },
      all: [{ ...mockUser }],
      run: { meta: { changes: 0 } },
    };
  }

  // INSERT INTO permissions ... RETURNING id
  if (sqlLower.includes("insert") && sqlLower.includes("permissions")) {
    return {
      first: { id: 1 },
      all: [{ id: 1 }],
      run: { meta: { changes: 1 } },
    };
  }

  // SELECT * FROM permissions WHERE id = ?
  if (sqlLower.includes("select") && sqlLower.includes("from permissions")) {
    const permId = boundArgs[0];
    if (permId === 999 || permId === "999") {
      return { first: null, all: [], run: { meta: { changes: 0 } } };
    }
    return {
      first: { ...mockPermission },
      all: [{ ...mockPermission }],
      run: { meta: { changes: 0 } },
    };
  }

  // UPDATE permissions
  if (sqlLower.includes("update") && sqlLower.includes("permissions")) {
    return {
      first: null,
      all: [],
      run: { meta: { changes: 1 } },
    };
  }

  // SELECT * FROM rules
  if (sqlLower.includes("from rules")) {
    return { first: null, all: [], run: { meta: { changes: 0 } } };
  }

  // SELECT * FROM audit_log
  if (sqlLower.includes("from audit_log")) {
    return { first: null, all: [], run: { meta: { changes: 0 } } };
  }

  // SELECT * FROM api_keys
  if (sqlLower.includes("from api_keys")) {
    return { first: null, all: [], run: { meta: { changes: 0 } } };
  }

  // INSERT INTO audit_log
  if (sqlLower.includes("insert") && sqlLower.includes("audit_log")) {
    return { first: null, all: [], run: { meta: { changes: 1 } } };
  }

  // SELECT * FROM webhooks
  if (sqlLower.includes("from webhooks")) {
    return { first: null, all: [], run: { meta: { changes: 0 } } };
  }

  // Default: return empty results
  return { first: null, all: [], run: { meta: { changes: 0 } } };
}

function createMockStatement(sql: string, boundArgs: unknown[] = []) {
  const getResult = () => determineMockResult(sql, boundArgs);

  return {
    bind(...args: unknown[]) {
      return createMockStatement(sql, args);
    },
    async first<T = unknown>(_colName?: string): Promise<T | null> {
      return getResult().first as T | null;
    },
    async all<T = unknown>(): Promise<{ results: T[]; success: boolean; meta: Record<string, unknown> }> {
      return {
        results: getResult().all as T[],
        success: true,
        meta: {},
      };
    },
    async run(): Promise<{ success: boolean; meta: { changes: number } }> {
      return {
        success: true,
        ...getResult().run,
      };
    },
    async raw<T = unknown[]>(): Promise<T[]> {
      return getResult().all as T[];
    },
  };
}

// ---------------------------------------------------------------------------
// Mock D1Database
// ---------------------------------------------------------------------------

export function createMockDB(): D1Database {
  return {
    prepare(sql: string) {
      return createMockStatement(sql);
    },
    dump(): Promise<ArrayBuffer> {
      return Promise.resolve(new ArrayBuffer(0));
    },
    batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
      return Promise.resolve([]);
    },
    exec(sql: string): Promise<D1ExecResult> {
      return Promise.resolve({ count: 0, duration: 0 });
    },
  } as unknown as D1Database;
}

// ---------------------------------------------------------------------------
// Mock KVNamespace
// ---------------------------------------------------------------------------

export function createMockKV(): KVNamespace {
  const store = new Map<string, string>();

  return {
    async get(key: string, _opts?: unknown): Promise<string | null> {
      return store.get(key) ?? null;
    },
    async put(key: string, value: string, _opts?: unknown): Promise<void> {
      store.set(key, value);
    },
    async delete(key: string): Promise<void> {
      store.delete(key);
    },
    async list(_opts?: unknown): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor: string }> {
      return {
        keys: Array.from(store.keys()).map((name) => ({ name })),
        list_complete: true,
        cursor: "",
      };
    },
    async getWithMetadata(key: string, _opts?: unknown): Promise<{ value: string | null; metadata: unknown }> {
      return { value: store.get(key) ?? null, metadata: null };
    },
  } as unknown as KVNamespace;
}

// ---------------------------------------------------------------------------
// Mock env bindings
// ---------------------------------------------------------------------------

export function createMockBindings(overrides?: {
  db?: D1Database;
  kv?: KVNamespace;
}) {
  return {
    DB: overrides?.db ?? createMockDB(),
    SESSIONS: overrides?.kv ?? createMockKV(),
    GITHUB_CLIENT_ID: "test-client-id",
    GITHUB_CLIENT_SECRET: "test-client-secret",
    STRIPE_SECRET_KEY: "sk_test_fake",
    STRIPE_WEBHOOK_SECRET: "whsec_test_fake",
    APP_URL: "http://localhost:8787",
  };
}

// ---------------------------------------------------------------------------
// Test app helper
// ---------------------------------------------------------------------------

export function createTestApp() {
  // We dynamically import to avoid module-level side effects
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const app = require("../index").default;
  return app;
}

// ---------------------------------------------------------------------------
// Auth session helper
// ---------------------------------------------------------------------------

export async function createAuthSession(
  kv: KVNamespace,
  user: User = mockUser
): Promise<string> {
  const token = "test-session-token-" + Math.random().toString(36).slice(2);
  await kv.put(
    token,
    JSON.stringify({ userId: user.id, githubToken: "gh_test_token" })
  );
  return token;
}

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

export function authHeaders(sessionToken: string): Record<string, string> {
  return {
    Cookie: `session=${sessionToken}`,
  };
}

export function jsonHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...extra,
  };
}

/**
 * Mock ExecutionContext for Cloudflare Workers.
 * waitUntil() silently runs the promise; passThroughOnException() is a no-op.
 */
export function createMockExecutionCtx(): ExecutionContext {
  return {
    waitUntil(promise: Promise<unknown>): void {
      // Fire-and-forget; swallow errors to avoid unhandled rejections in tests
      promise.catch(() => {});
    },
    passThroughOnException(): void {
      // no-op
    },
    props: {},
  } as unknown as ExecutionContext;
}

/**
 * Make a request to the Hono app with mock bindings injected.
 * Uses Hono's built-in app.request() method.
 */
export async function appRequest(
  method: string,
  path: string,
  options?: {
    body?: unknown;
    headers?: Record<string, string>;
    bindings?: ReturnType<typeof createMockBindings>;
  }
) {
  const app = createTestApp();
  const bindings = options?.bindings ?? createMockBindings();
  const url = `http://localhost${path}`;

  const init: RequestInit & { headers: Record<string, string> } = {
    method,
    headers: {
      ...(options?.headers ?? {}),
    },
  };

  if (options?.body) {
    init.body = JSON.stringify(options.body);
    init.headers["Content-Type"] =
      init.headers["Content-Type"] ?? "application/json";
  }

  return app.request(url, init, bindings, createMockExecutionCtx());
}

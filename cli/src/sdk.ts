// GateCode SDK — zero-dependency TypeScript client for gatecode.sh

const VERSION = "0.1.0";
const DEFAULT_BASE_URL = "https://gatecode.sh";
const DEFAULT_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const POLL_INTERVAL = 2000; // 2 seconds

// ── Types ────────────────────────────────────────────────────────────────────

export interface GateCodeOptions {
  apiKey: string;
  baseUrl?: string;
  username?: string;
}

export interface RequestOptions {
  repo: string;
  scope: "read" | "write";
  reason?: string;
}

export interface RequestResult {
  id: number;
  status: "pending" | "approved" | "denied";
}

export interface StatusResult {
  id: number;
  status: string;
  token?: string;
  expires_at?: string;
}

export interface WaitResult {
  id: number;
  status: "approved" | "denied" | "timeout";
  token?: string;
  expires_at?: string;
}

export interface RequestAndWaitOptions extends RequestOptions {
  timeout?: number;
}

export interface ApiKey {
  id: number;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at?: string;
}

// ── Errors ───────────────────────────────────────────────────────────────────

export class GateCodeError extends Error {
  public readonly statusCode?: number;
  public readonly body?: unknown;

  constructor(message: string, statusCode?: number, body?: unknown) {
    super(message);
    this.name = "GateCodeError";
    this.statusCode = statusCode;
    this.body = body;
  }
}

// ── SDK Client ───────────────────────────────────────────────────────────────

export class GateCode {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly username?: string;

  constructor(options: GateCodeOptions) {
    if (!options.apiKey) {
      throw new GateCodeError("API key is required");
    }
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.username = options.username;
  }

  /** Request access to a repository. */
  async request(opts: RequestOptions): Promise<RequestResult> {
    const body: Record<string, string> = {
      repo: opts.repo,
      scope: opts.scope,
    };
    if (opts.reason) body.reason = opts.reason;
    if (this.username) body.username = this.username;

    const res = await this.fetch("/api/request", {
      method: "POST",
      body: JSON.stringify(body),
    });

    return res as RequestResult;
  }

  /** Poll for the current status of an access request. */
  async status(requestId: number): Promise<StatusResult> {
    const res = await this.fetch(`/api/status/${requestId}`, {
      method: "GET",
    });

    return res as StatusResult;
  }

  /** Request access and wait for approval with exponential backoff. */
  async requestAndWait(opts: RequestAndWaitOptions): Promise<WaitResult> {
    const timeout = opts.timeout ?? DEFAULT_TIMEOUT;
    const req = await this.request(opts);

    if (req.status === "approved" || req.status === "denied") {
      const full = await this.status(req.id);
      return {
        id: req.id,
        status: req.status,
        token: full.token,
        expires_at: full.expires_at,
      };
    }

    const start = Date.now();
    let interval = POLL_INTERVAL;

    while (Date.now() - start < timeout) {
      await sleep(interval);

      const result = await this.status(req.id);

      if (result.status === "approved" || result.status === "denied") {
        return {
          id: req.id,
          status: result.status as "approved" | "denied",
          token: result.token,
          expires_at: result.expires_at,
        };
      }

      // Exponential backoff: 2s, 4s, 8s, capped at 15s
      interval = Math.min(interval * 2, 15_000);
    }

    return { id: req.id, status: "timeout" };
  }

  /** List your API keys. */
  async listKeys(): Promise<ApiKey[]> {
    const res = await this.fetch("/api/keys", { method: "GET" });
    return res as ApiKey[];
  }

  /** Fetch the current user profile. */
  async whoami(): Promise<{ username: string; email?: string }> {
    const res = await this.fetch("/api/whoami", { method: "GET" });
    return res as { username: string; email?: string };
  }

  // ── Internal ─────────────────────────────────────────────────────────────

  private async fetch(path: string, init: RequestInit): Promise<unknown> {
    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      "X-GateCode-Key": this.apiKey,
      "User-Agent": `gatecode-sdk/${VERSION}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    let res: Response;
    try {
      res = await globalThis.fetch(url, {
        ...init,
        headers: { ...headers, ...(init.headers as Record<string, string>) },
      });
    } catch (err) {
      throw new GateCodeError(
        `Network error: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    let body: unknown;
    const text = await res.text();
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }

    if (!res.ok) {
      const msg =
        typeof body === "object" && body !== null && "error" in body
          ? String((body as Record<string, unknown>).error)
          : `HTTP ${res.status}`;
      throw new GateCodeError(msg, res.status, body);
    }

    return body;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

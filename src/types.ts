// Re-export model types from the canonical source
export type { User, Permission, Rule, AuditEntry } from "./db/queries";

export type Env = {
  Bindings: {
    DB: D1Database;
    SESSIONS: KVNamespace;
    GITHUB_CLIENT_ID: string;
    GITHUB_CLIENT_SECRET: string;
    APP_URL: string;
    STRIPE_SECRET_KEY: string;
    STRIPE_WEBHOOK_SECRET: string;
  };
  Variables: {
    user: import("./db/queries").User;
    githubToken: string;
  };
};

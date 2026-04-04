// GateCode — D1 query helpers

export interface User {
  id: number;
  github_id: number;
  username: string;
  email: string | null;
  avatar_url: string | null;
  plan: "free" | "pro" | "team" | "enterprise";
  created_at: string;
}

export interface Permission {
  id: number;
  user_id: number;
  agent_id: string;
  repo: string;
  scope: "read" | "write";
  status: "pending" | "approved" | "denied";
  token: string | null;
  expires_at: string | null;
  reason: string | null;
  created_at: string;
}

export interface Rule {
  id: number;
  user_id: number;
  pattern: string;
  scope: "read" | "write";
  action: "auto_approve" | "auto_deny" | "ask";
  created_at: string;
}

export interface AuditEntry {
  id: number;
  user_id: number;
  agent_id: string;
  repo: string;
  scope: string;
  action: "approved" | "denied" | "auto_approved" | "auto_denied";
  ip_address: string | null;
  timestamp: string;
}

// ── Users ───────────────────────────────────────────────────────────

export async function createUser(
  db: D1Database,
  params: {
    github_id: number;
    username: string;
    email: string | null;
    avatar_url: string | null;
  }
): Promise<User> {
  await db
    .prepare(
      `INSERT OR IGNORE INTO users (github_id, username, email, avatar_url)
       VALUES (?, ?, ?, ?)`
    )
    .bind(params.github_id, params.username, params.email, params.avatar_url)
    .run();

  const row = await db
    .prepare(`SELECT * FROM users WHERE github_id = ?`)
    .bind(params.github_id)
    .first<User>();

  return row!;
}

export async function getUserByGithubId(
  db: D1Database,
  github_id: number
): Promise<User | null> {
  return db
    .prepare(`SELECT * FROM users WHERE github_id = ?`)
    .bind(github_id)
    .first<User>();
}

export async function getUserById(
  db: D1Database,
  id: number
): Promise<User | null> {
  return db
    .prepare(`SELECT * FROM users WHERE id = ?`)
    .bind(id)
    .first<User>();
}

// ── Permissions ─────────────────────────────────────────────────────

export async function createPermission(
  db: D1Database,
  params: {
    user_id: number;
    agent_id: string;
    repo: string;
    scope: "read" | "write";
    reason: string | null;
  }
): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO permissions (user_id, agent_id, repo, scope, reason)
       VALUES (?, ?, ?, ?, ?)
       RETURNING id`
    )
    .bind(
      params.user_id,
      params.agent_id,
      params.repo,
      params.scope,
      params.reason
    )
    .first<{ id: number }>();

  return result!.id;
}

export async function getPendingPermissions(
  db: D1Database,
  user_id: number
): Promise<Permission[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM permissions
       WHERE user_id = ? AND status = 'pending'
       ORDER BY created_at DESC`
    )
    .bind(user_id)
    .all<Permission>();

  return results;
}

export async function getPermissionById(
  db: D1Database,
  id: number
): Promise<Permission | null> {
  return db
    .prepare(`SELECT * FROM permissions WHERE id = ?`)
    .bind(id)
    .first<Permission>();
}

export async function approvePermission(
  db: D1Database,
  id: number,
  token: string,
  expires_at: string
): Promise<void> {
  await db
    .prepare(
      `UPDATE permissions
       SET status = 'approved', token = ?, expires_at = ?
       WHERE id = ?`
    )
    .bind(token, expires_at, id)
    .run();
}

export async function denyPermission(
  db: D1Database,
  id: number
): Promise<void> {
  await db
    .prepare(`UPDATE permissions SET status = 'denied' WHERE id = ?`)
    .bind(id)
    .run();
}

// ── Rules ───────────────────────────────────────────────────────────

export async function getRules(
  db: D1Database,
  user_id: number
): Promise<Rule[]> {
  const { results } = await db
    .prepare(`SELECT * FROM rules WHERE user_id = ? ORDER BY created_at DESC`)
    .bind(user_id)
    .all<Rule>();

  return results;
}

export async function createRule(
  db: D1Database,
  params: {
    user_id: number;
    pattern: string;
    scope: "read" | "write";
    action: "auto_approve" | "auto_deny" | "ask";
  }
): Promise<Rule> {
  const row = await db
    .prepare(
      `INSERT INTO rules (user_id, pattern, scope, action)
       VALUES (?, ?, ?, ?)
       RETURNING *`
    )
    .bind(params.user_id, params.pattern, params.scope, params.action)
    .first<Rule>();

  return row!;
}

export async function deleteRule(
  db: D1Database,
  id: number,
  user_id: number
): Promise<boolean> {
  const result = await db
    .prepare(`DELETE FROM rules WHERE id = ? AND user_id = ?`)
    .bind(id, user_id)
    .run();

  return result.meta.changes > 0;
}

export async function matchRule(
  db: D1Database,
  user_id: number,
  repo: string,
  scope: "read" | "write"
): Promise<Rule | null> {
  return db
    .prepare(
      `SELECT * FROM rules
       WHERE user_id = ? AND scope = ? AND (pattern = ? OR ? LIKE pattern)
       ORDER BY
         CASE WHEN pattern = ? THEN 0 ELSE 1 END,
         created_at DESC
       LIMIT 1`
    )
    .bind(user_id, scope, repo, repo, repo)
    .first<Rule>();
}

// ── Audit Log ───────────────────────────────────────────────────────

export async function addAuditLog(
  db: D1Database,
  params: {
    user_id: number;
    agent_id: string;
    repo: string;
    scope: string;
    action: "approved" | "denied" | "auto_approved" | "auto_denied";
    ip_address: string | null;
  }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO audit_log (user_id, agent_id, repo, scope, action, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(
      params.user_id,
      params.agent_id,
      params.repo,
      params.scope,
      params.action,
      params.ip_address
    )
    .run();
}

export async function getAuditLog(
  db: D1Database,
  user_id: number,
  options: { limit?: number; offset?: number } = {}
): Promise<AuditEntry[]> {
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  const { results } = await db
    .prepare(
      `SELECT * FROM audit_log
       WHERE user_id = ?
       ORDER BY timestamp DESC
       LIMIT ? OFFSET ?`
    )
    .bind(user_id, limit, offset)
    .all<AuditEntry>();

  return results;
}

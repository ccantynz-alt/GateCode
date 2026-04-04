-- GateCode D1 SQLite Schema

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  github_id INTEGER UNIQUE NOT NULL,
  username TEXT NOT NULL,
  email TEXT,
  avatar_url TEXT,
  plan TEXT DEFAULT 'free' CHECK(plan IN ('free', 'pro', 'team', 'enterprise')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  agent_id TEXT NOT NULL,
  repo TEXT NOT NULL,
  scope TEXT NOT NULL CHECK(scope IN ('read', 'write')),
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'denied')),
  token TEXT,
  expires_at TEXT,
  reason TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  pattern TEXT NOT NULL,
  scope TEXT NOT NULL CHECK(scope IN ('read', 'write')),
  action TEXT NOT NULL CHECK(action IN ('auto_approve', 'auto_deny', 'ask')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  agent_id TEXT NOT NULL,
  repo TEXT NOT NULL,
  scope TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('approved', 'denied', 'auto_approved', 'auto_denied')),
  ip_address TEXT,
  timestamp TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_permissions_user_status ON permissions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_rules_user ON rules(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_timestamp ON audit_log(user_id, timestamp);

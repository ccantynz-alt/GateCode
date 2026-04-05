#!/usr/bin/env bash
# ============================================================================
# GUARD HOOK — Blocks dangerous Bash commands before execution
# Trigger: PreToolUse (Bash)
# Exit 0 = allow, Exit 2 = block (stderr sent back to Claude)
# ============================================================================

set -euo pipefail

# Read the tool input from stdin (JSON)
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null || echo "")

if [ -z "$COMMAND" ]; then
  exit 0  # No command found, allow
fi

# Normalize: lowercase for pattern matching
CMD_LOWER=$(echo "$COMMAND" | tr '[:upper:]' '[:lower:]')

# ── Destructive file operations ──────────────────────────────────────────
if echo "$CMD_LOWER" | grep -qE 'rm\s+(-[a-z]*f[a-z]*\s+)?(-[a-z]*r[a-z]*\s+)?(\/|\~|\.\.?\s|\.\.?\/)'; then
  echo "BLOCKED: Recursive delete on root, home, or parent directory. This is almost always catastrophic." >&2
  exit 2
fi

if echo "$CMD_LOWER" | grep -qE 'rm\s+-rf\s+\*'; then
  echo "BLOCKED: rm -rf * is too dangerous. Be specific about what to delete." >&2
  exit 2
fi

# ── Git force push ───────────────────────────────────────────────────────
if echo "$CMD_LOWER" | grep -qE 'git\s+push\s+.*--force|git\s+push\s+.*-f\b'; then
  echo "BLOCKED: Force push is banned. It rewrites shared history and can destroy work. Use --force-with-lease if you absolutely must, and get explicit user approval first." >&2
  exit 2
fi

# ── Git reset --hard ─────────────────────────────────────────────────────
if echo "$CMD_LOWER" | grep -qE 'git\s+reset\s+--hard'; then
  echo "BLOCKED: git reset --hard discards all uncommitted changes permanently. Stash or commit first." >&2
  exit 2
fi

# ── Git checkout/restore that wipes changes ──────────────────────────────
if echo "$CMD_LOWER" | grep -qE 'git\s+checkout\s+--\s+\.|git\s+checkout\s+\.\s*$'; then
  echo "BLOCKED: git checkout -- . discards all unstaged changes. Be specific about which files to restore." >&2
  exit 2
fi

if echo "$CMD_LOWER" | grep -qE 'git\s+restore\s+\.\s*$'; then
  echo "BLOCKED: git restore . discards all unstaged changes. Be specific about which files to restore." >&2
  exit 2
fi

# ── Git clean ────────────────────────────────────────────────────────────
if echo "$CMD_LOWER" | grep -qE 'git\s+clean\s+.*-f'; then
  echo "BLOCKED: git clean -f permanently deletes untracked files. Use git clean -n (dry run) first." >&2
  exit 2
fi

# ── Skip hooks ───────────────────────────────────────────────────────────
if echo "$CMD_LOWER" | grep -qE 'git\s+.*--no-verify'; then
  echo "BLOCKED: --no-verify skips pre-commit hooks. Fix the hook failure instead of bypassing it." >&2
  exit 2
fi

# ── Dangerous SQL ────────────────────────────────────────────────────────
if echo "$CMD_LOWER" | grep -qiE 'drop\s+(table|database|schema)\s'; then
  echo "BLOCKED: DROP TABLE/DATABASE/SCHEMA detected. This is irreversible. Get explicit user approval." >&2
  exit 2
fi

if echo "$CMD_LOWER" | grep -qiE 'delete\s+from\s+\w+\s*$' | grep -qvE 'where'; then
  # DELETE FROM table without WHERE clause
  if ! echo "$CMD_LOWER" | grep -qiE 'where'; then
    echo "BLOCKED: DELETE FROM without WHERE clause would delete all rows. Add a WHERE clause." >&2
    exit 2
  fi
fi

if echo "$CMD_LOWER" | grep -qiE 'truncate\s+'; then
  echo "BLOCKED: TRUNCATE detected. This deletes all data. Get explicit user approval." >&2
  exit 2
fi

# ── Insecure permissions ─────────────────────────────────────────────────
if echo "$CMD_LOWER" | grep -qE 'chmod\s+777'; then
  echo "BLOCKED: chmod 777 gives everyone read/write/execute. Use more restrictive permissions (755 for dirs, 644 for files)." >&2
  exit 2
fi

# ── Pipe to shell (supply chain risk) ────────────────────────────────────
if echo "$CMD_LOWER" | grep -qE 'curl\s+.*\|\s*(bash|sh|zsh)|wget\s+.*\|\s*(bash|sh|zsh)'; then
  echo "BLOCKED: Piping a URL directly to a shell is a supply chain attack vector. Download the script first, review it, then execute." >&2
  exit 2
fi

# ── Env/secret leaks in commands ─────────────────────────────────────────
if echo "$COMMAND" | grep -qE '(sk_live|sk_test|ghp_|gho_|github_pat_|AKIA[A-Z0-9]{16}|-----BEGIN (RSA |EC )?PRIVATE KEY)'; then
  echo "BLOCKED: Possible secret/token detected in command. Use environment variables instead of hardcoding secrets." >&2
  exit 2
fi

# ── Kill all / shutdown ──────────────────────────────────────────────────
if echo "$CMD_LOWER" | grep -qE 'kill\s+-9\s+-1|killall\s+-9|shutdown|reboot|halt|init\s+0'; then
  echo "BLOCKED: System-wide kill/shutdown command detected. Be specific about which process to stop." >&2
  exit 2
fi

# ── Disk format / partition ──────────────────────────────────────────────
if echo "$CMD_LOWER" | grep -qE 'mkfs\.|fdisk|dd\s+.*of=/dev/'; then
  echo "BLOCKED: Disk format/partition command detected. This can destroy data." >&2
  exit 2
fi

# If we got here, the command is allowed
exit 0

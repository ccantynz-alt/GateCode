#!/usr/bin/env bash
# ============================================================================
# PRE-STOP HOOK — Verifies clean state before Claude finishes
# Trigger: Stop
# Exit 0 always (warnings only) — reminds Claude about uncommitted work
# ============================================================================

set -uo pipefail

WARNINGS=""

# ── Check for uncommitted changes ────────────────────────────────────────
if git rev-parse --is-inside-work-tree &>/dev/null; then
  UNCOMMITTED=$(git status --porcelain 2>/dev/null | head -20)
  if [ -n "$UNCOMMITTED" ]; then
    WARNINGS="${WARNINGS}WARNING: There are uncommitted changes in the repository:\n"
    WARNINGS="${WARNINGS}${UNCOMMITTED}\n\n"
    WARNINGS="${WARNINGS}Please commit and push these changes to the remote branch.\n"
    WARNINGS="${WARNINGS}Do not create a pull request unless the user has explicitly asked for one.\n\n"
  fi

  # Check if branch is behind remote
  git fetch origin 2>/dev/null || true
  LOCAL=$(git rev-parse HEAD 2>/dev/null)
  BRANCH=$(git branch --show-current 2>/dev/null)
  if [ -n "$BRANCH" ]; then
    REMOTE=$(git rev-parse "origin/$BRANCH" 2>/dev/null || echo "")
    if [ -n "$REMOTE" ] && [ "$LOCAL" != "$REMOTE" ]; then
      AHEAD=$(git log "origin/$BRANCH..HEAD" --oneline 2>/dev/null | wc -l | tr -d ' ')
      if [ "$AHEAD" -gt 0 ]; then
        WARNINGS="${WARNINGS}WARNING: Local branch is $AHEAD commit(s) ahead of origin/$BRANCH. Push your changes.\n\n"
      fi
    fi
  fi
fi

# ── Run quality gates (if changes exist) ─────────────────────────────────
if [ -n "$UNCOMMITTED" ]; then

  # TypeScript
  if [ -f "tsconfig.json" ]; then
    if ! npx tsc --noEmit &>/dev/null; then
      WARNINGS="${WARNINGS}WARNING: TypeScript compilation has errors. Run 'npx tsc --noEmit' to see them.\n"
    fi
  fi

  # Python
  if [ -f "pyproject.toml" ] || [ -f "setup.py" ] || [ -f "requirements.txt" ]; then
    if command -v mypy &>/dev/null; then
      if ! mypy . &>/dev/null; then
        WARNINGS="${WARNINGS}WARNING: mypy found type errors.\n"
      fi
    fi
  fi

  # Go
  if [ -f "go.mod" ]; then
    if ! go vet ./... &>/dev/null; then
      WARNINGS="${WARNINGS}WARNING: go vet found issues.\n"
    fi
  fi

  # Rust
  if [ -f "Cargo.toml" ]; then
    if ! cargo check &>/dev/null; then
      WARNINGS="${WARNINGS}WARNING: cargo check found errors.\n"
    fi
  fi

  # Tests
  if [ -f "package.json" ]; then
    if command -v bun &>/dev/null && [ -d "src/__tests__" ]; then
      if ! bun test &>/dev/null; then
        WARNINGS="${WARNINGS}WARNING: Tests are failing. Run 'bun test' to see failures.\n"
      fi
    fi
  fi

  if [ -f "pyproject.toml" ] || [ -f "pytest.ini" ] || [ -f "setup.cfg" ]; then
    if command -v pytest &>/dev/null; then
      if ! pytest --tb=no -q &>/dev/null; then
        WARNINGS="${WARNINGS}WARNING: pytest found failing tests.\n"
      fi
    fi
  fi
fi

# ── Output warnings ─────────────────────────────────────────────────────
if [ -n "$WARNINGS" ]; then
  echo -e "$WARNINGS"
fi

exit 0

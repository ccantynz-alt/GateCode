#!/usr/bin/env bash
# ============================================================================
# POST-EDIT HOOK — Runs language-appropriate quality checks after file edits
# Trigger: PostToolUse (Edit, Write)
# Exit 0 always (non-blocking) — outputs errors as context for Claude to fix
# ============================================================================

set -uo pipefail

# Read the tool input from stdin (JSON)
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null || echo "")

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Get file extension
EXT="${FILE_PATH##*.}"

# ── TypeScript / JavaScript ──────────────────────────────────────────────
if [[ "$EXT" == "ts" || "$EXT" == "tsx" || "$EXT" == "js" || "$EXT" == "jsx" || "$EXT" == "mts" || "$EXT" == "cts" ]]; then
  # Check if tsconfig.json exists (TypeScript project)
  if [ -f "tsconfig.json" ]; then
    ERRORS=$(npx tsc --noEmit 2>&1) || true
    if [ -n "$ERRORS" ]; then
      echo "TypeScript errors detected after editing $FILE_PATH:"
      echo "$ERRORS" | head -30
      echo ""
      echo "Fix these errors before committing."
    fi
  fi
  exit 0
fi

# ── Python ───────────────────────────────────────────────────────────────
if [[ "$EXT" == "py" || "$EXT" == "pyi" ]]; then
  # Try mypy first
  if command -v mypy &>/dev/null; then
    ERRORS=$(mypy "$FILE_PATH" 2>&1) || true
    if echo "$ERRORS" | grep -q "error:"; then
      echo "Mypy errors detected in $FILE_PATH:"
      echo "$ERRORS" | grep "error:" | head -20
      echo ""
      echo "Fix these type errors before committing."
    fi
  fi
  # Try ruff
  if command -v ruff &>/dev/null; then
    ERRORS=$(ruff check "$FILE_PATH" 2>&1) || true
    if [ -n "$ERRORS" ] && ! echo "$ERRORS" | grep -q "All checks passed"; then
      echo "Ruff lint errors in $FILE_PATH:"
      echo "$ERRORS" | head -20
    fi
  fi
  exit 0
fi

# ── Go ───────────────────────────────────────────────────────────────────
if [[ "$EXT" == "go" ]]; then
  if command -v go &>/dev/null; then
    ERRORS=$(go vet ./... 2>&1) || true
    if [ -n "$ERRORS" ]; then
      echo "Go vet errors detected after editing $FILE_PATH:"
      echo "$ERRORS" | head -20
      echo ""
      echo "Fix these errors before committing."
    fi
  fi
  exit 0
fi

# ── Rust ─────────────────────────────────────────────────────────────────
if [[ "$EXT" == "rs" ]]; then
  if command -v cargo &>/dev/null; then
    ERRORS=$(cargo check --message-format=short 2>&1) || true
    if echo "$ERRORS" | grep -q "^error"; then
      echo "Cargo check errors after editing $FILE_PATH:"
      echo "$ERRORS" | grep "^error" | head -20
      echo ""
      echo "Fix these errors before committing."
    fi
  fi
  exit 0
fi

# ── JSON (validate syntax) ──────────────────────────────────────────────
if [[ "$EXT" == "json" ]]; then
  if command -v jq &>/dev/null; then
    if ! jq empty "$FILE_PATH" 2>/dev/null; then
      echo "Invalid JSON syntax in $FILE_PATH. Fix the syntax error."
    fi
  fi
  exit 0
fi

# ── YAML (validate syntax) ──────────────────────────────────────────────
if [[ "$EXT" == "yml" || "$EXT" == "yaml" ]]; then
  if command -v python3 &>/dev/null; then
    if ! python3 -c "import yaml; yaml.safe_load(open('$FILE_PATH'))" 2>/dev/null; then
      echo "Invalid YAML syntax in $FILE_PATH. Fix the syntax error."
    fi
  fi
  exit 0
fi

# ── SQL (basic checks) ──────────────────────────────────────────────────
if [[ "$EXT" == "sql" ]]; then
  # Check for common dangerous patterns
  if grep -qiE 'DROP\s+(TABLE|DATABASE)' "$FILE_PATH" 2>/dev/null; then
    echo "WARNING: $FILE_PATH contains DROP TABLE/DATABASE statements. Ensure this is intentional."
  fi
  exit 0
fi

# Unknown file type — no checks
exit 0

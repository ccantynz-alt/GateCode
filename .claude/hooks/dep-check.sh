#!/usr/bin/env bash
# ============================================================================
# DEP-CHECK HOOK — Audits dependencies for security, staleness, and upgrades
# Trigger: SessionStart
# Exit 0 always — outputs findings as context for Claude to act on
# ============================================================================

set -uo pipefail

FINDINGS=""

echo "Auditing project dependencies..."

# ── Node.js / npm ────────────────────────────────────────────────────────
if [ -f "package.json" ]; then
  # Security audit
  if command -v npm &>/dev/null; then
    AUDIT=$(npm audit --json 2>/dev/null || echo '{}')
    VULNS=$(echo "$AUDIT" | jq -r '.metadata.vulnerabilities // {} | to_entries[] | select(.value > 0) | "\(.key): \(.value)"' 2>/dev/null || echo "")
    if [ -n "$VULNS" ]; then
      FINDINGS="${FINDINGS}## npm Security Audit\n"
      FINDINGS="${FINDINGS}Vulnerabilities found:\n${VULNS}\n"
      FINDINGS="${FINDINGS}Run 'npm audit' for details. Fix critical/high issues immediately.\n\n"
    fi
  fi

  # Outdated packages
  if command -v npm &>/dev/null; then
    OUTDATED=$(npm outdated --json 2>/dev/null || echo '{}')
    MAJOR_UPDATES=$(echo "$OUTDATED" | jq -r 'to_entries[] | select(.value.current != .value.latest) | "\(.key): \(.value.current) -> \(.value.latest)"' 2>/dev/null | head -10 || echo "")
    if [ -n "$MAJOR_UPDATES" ]; then
      FINDINGS="${FINDINGS}## Outdated npm Packages\n"
      FINDINGS="${FINDINGS}${MAJOR_UPDATES}\n"
      FINDINGS="${FINDINGS}Consider upgrading. Check changelogs for breaking changes.\n\n"
    fi
  fi
fi

# ── Python / pip ─────────────────────────────────────────────────────────
if [ -f "pyproject.toml" ] || [ -f "requirements.txt" ] || [ -f "setup.py" ]; then
  # Security audit
  if command -v pip-audit &>/dev/null; then
    AUDIT=$(pip-audit --format=json 2>/dev/null || echo '[]')
    VULN_COUNT=$(echo "$AUDIT" | jq 'length' 2>/dev/null || echo "0")
    if [ "$VULN_COUNT" -gt 0 ]; then
      FINDINGS="${FINDINGS}## pip Security Audit\n"
      FINDINGS="${FINDINGS}${VULN_COUNT} vulnerable package(s) found.\n"
      FINDINGS="${FINDINGS}Run 'pip-audit' for details. Fix immediately.\n\n"
    fi
  elif command -v pip &>/dev/null; then
    # Fallback: check for outdated
    OUTDATED=$(pip list --outdated --format=json 2>/dev/null || echo '[]')
    COUNT=$(echo "$OUTDATED" | jq 'length' 2>/dev/null || echo "0")
    if [ "$COUNT" -gt 0 ]; then
      UPDATES=$(echo "$OUTDATED" | jq -r '.[:10][] | "\(.name): \(.version) -> \(.latest_version)"' 2>/dev/null || echo "")
      FINDINGS="${FINDINGS}## Outdated Python Packages\n"
      FINDINGS="${FINDINGS}${UPDATES}\n\n"
    fi
  fi
fi

# ── Go modules ───────────────────────────────────────────────────────────
if [ -f "go.mod" ]; then
  if command -v govulncheck &>/dev/null; then
    VULNS=$(govulncheck ./... 2>&1 || echo "")
    if echo "$VULNS" | grep -q "Vulnerability"; then
      FINDINGS="${FINDINGS}## Go Vulnerability Check\n"
      FINDINGS="${FINDINGS}Vulnerabilities detected. Run 'govulncheck ./...' for details.\n\n"
    fi
  fi

  # Check for outdated modules
  if command -v go &>/dev/null; then
    OUTDATED=$(go list -m -u all 2>/dev/null | grep '\[' | head -10 || echo "")
    if [ -n "$OUTDATED" ]; then
      FINDINGS="${FINDINGS}## Outdated Go Modules\n"
      FINDINGS="${FINDINGS}${OUTDATED}\n\n"
    fi
  fi
fi

# ── Rust / Cargo ─────────────────────────────────────────────────────────
if [ -f "Cargo.toml" ]; then
  if command -v cargo-audit &>/dev/null; then
    AUDIT=$(cargo audit --json 2>/dev/null || echo '{}')
    VULN_COUNT=$(echo "$AUDIT" | jq '.vulnerabilities.found' 2>/dev/null || echo "0")
    if [ "$VULN_COUNT" -gt 0 ]; then
      FINDINGS="${FINDINGS}## Cargo Security Audit\n"
      FINDINGS="${FINDINGS}${VULN_COUNT} vulnerability(ies) found.\n"
      FINDINGS="${FINDINGS}Run 'cargo audit' for details. Fix immediately.\n\n"
    fi
  fi

  # Check for outdated crates
  if command -v cargo-outdated &>/dev/null; then
    OUTDATED=$(cargo outdated --root-deps-only 2>/dev/null | tail -n +3 | head -10 || echo "")
    if [ -n "$OUTDATED" ]; then
      FINDINGS="${FINDINGS}## Outdated Rust Crates\n"
      FINDINGS="${FINDINGS}${OUTDATED}\n\n"
    fi
  fi
fi

# ── Output findings ─────────────────────────────────────────────────────
if [ -n "$FINDINGS" ]; then
  echo ""
  echo "============================================"
  echo "DEPENDENCY AUDIT RESULTS"
  echo "============================================"
  echo -e "$FINDINGS"
  echo "Review these findings and address critical issues."
else
  echo "All dependencies look healthy. No vulnerabilities or critical updates found."
fi

exit 0

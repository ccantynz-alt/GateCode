// GateCode — Glob pattern matching utilities

/** Convert a glob-style pattern (with * wildcards) into a RegExp. */
export function globToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const regexStr = "^" + escaped.replace(/\*/g, ".*") + "$";
  return new RegExp(regexStr);
}

/** Check whether a repo matches a rule pattern. */
export function matchesPattern(repo: string, pattern: string): boolean {
  return globToRegex(pattern).test(repo);
}

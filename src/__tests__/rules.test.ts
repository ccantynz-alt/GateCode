import { describe, it, expect } from "vitest";
import { globToRegex, matchesPattern } from "../lib/patterns";

describe("globToRegex", () => {
  it("produces a RegExp from a simple pattern", () => {
    const re = globToRegex("user/repo");
    expect(re).toBeInstanceOf(RegExp);
    expect(re.test("user/repo")).toBe(true);
  });

  it("escapes special regex characters in the pattern", () => {
    const re = globToRegex("user.name/repo");
    // The dot should be escaped, so "userXname/repo" should NOT match
    expect(re.test("userXname/repo")).toBe(false);
    expect(re.test("user.name/repo")).toBe(true);
  });
});

describe("matchesPattern", () => {
  it("exact match: 'user/repo' matches 'user/repo'", () => {
    expect(matchesPattern("user/repo", "user/repo")).toBe(true);
  });

  it("wildcard: 'user/*' matches 'user/repo'", () => {
    expect(matchesPattern("user/repo", "user/*")).toBe(true);
  });

  it("wildcard: 'user/*' does NOT match 'other/repo'", () => {
    expect(matchesPattern("other/repo", "user/*")).toBe(false);
  });

  it("complex glob: '*-test' matches 'my-test'", () => {
    expect(matchesPattern("my-test", "*-test")).toBe(true);
  });

  it("complex glob: '*-test' does NOT match 'my-testing'", () => {
    expect(matchesPattern("my-testing", "*-test")).toBe(false);
  });

  it("wildcard matches multiple segments: 'org/*' matches 'org/deep/repo'", () => {
    // .* matches anything including slashes
    expect(matchesPattern("org/deep/repo", "org/*")).toBe(true);
  });

  it("exact pattern does NOT match a different string", () => {
    expect(matchesPattern("user/other", "user/repo")).toBe(false);
  });
});

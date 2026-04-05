// GateCode — Health check, landing page, docs, and 404 tests

import { describe, test, expect } from "bun:test";
import { appRequest } from "./helpers";

describe("GET /health", () => {
  test("returns 200 with status ok", async () => {
    const res = await appRequest("GET", "/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.service).toBe("gatecode");
  });
});

describe("GET /", () => {
  test("returns 200 with HTML", async () => {
    const res = await appRequest("GET", "/", {
      headers: { Accept: "text/html" },
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("<!DOCTYPE html>");
    expect(text.toLowerCase()).toContain("gatecode");
  });
});

describe("GET /docs", () => {
  test("returns 200 with HTML", async () => {
    const res = await appRequest("GET", "/docs", {
      headers: { Accept: "text/html" },
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("<!DOCTYPE html>");
  });
});

describe("GET /nonexistent", () => {
  test("returns 404 JSON for non-HTML request", async () => {
    const res = await appRequest("GET", "/nonexistent");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Not found");
  });

  test("returns 404 HTML for HTML request", async () => {
    const res = await appRequest("GET", "/nonexistent", {
      headers: { Accept: "text/html" },
    });
    expect(res.status).toBe(404);
    const text = await res.text();
    expect(text).toContain("404");
  });
});

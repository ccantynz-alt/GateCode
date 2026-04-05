import { describe, it, expect } from "vitest";
import { GateCode, GateCodeError } from "../../cli/src/sdk";

describe("GateCode SDK client", () => {
  it("constructs successfully with an apiKey", () => {
    const client = new GateCode({ apiKey: "gc_test_key_123" });
    expect(client).toBeInstanceOf(GateCode);
  });

  it("throws GateCodeError when apiKey is missing", () => {
    expect(() => new GateCode({ apiKey: "" })).toThrow(GateCodeError);
    expect(() => new GateCode({ apiKey: "" })).toThrow("API key is required");
  });

  it("sets the default baseUrl to https://gatecode.sh", () => {
    const client = new GateCode({ apiKey: "gc_test_key_123" });
    const internals = client as unknown as { baseUrl: string };
    expect(internals.baseUrl).toBe("https://gatecode.sh");
  });

  it("accepts a custom baseUrl and strips trailing slashes", () => {
    const client = new GateCode({
      apiKey: "gc_test_key_123",
      baseUrl: "http://localhost:8787///",
    });
    const internals = client as unknown as { baseUrl: string };
    expect(internals.baseUrl).toBe("http://localhost:8787");
  });

  it("stores the optional username", () => {
    const client = new GateCode({
      apiKey: "gc_test_key_123",
      username: "testuser",
    });
    const internals = client as unknown as { username: string };
    expect(internals.username).toBe("testuser");
  });
});

describe("GateCodeError", () => {
  it("includes statusCode and body when provided", () => {
    const err = new GateCodeError("Not found", 404, { error: "missing" });
    expect(err.message).toBe("Not found");
    expect(err.statusCode).toBe(404);
    expect(err.body).toEqual({ error: "missing" });
    expect(err.name).toBe("GateCodeError");
  });

  it("is an instance of Error", () => {
    const err = new GateCodeError("test");
    expect(err).toBeInstanceOf(Error);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

import { verifyTurnstile } from "@/lib/leads/abuse";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("verifyTurnstile", () => {
  it("lets the enquiry continue when Turnstile is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");

    await expect(verifyTurnstile("dev-turnstile", "203.0.113.4")).resolves.toBe(
      true,
    );
  });

  it("still rejects a missing token when Turnstile is configured", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");

    await expect(verifyTurnstile(null, "203.0.113.4")).resolves.toBe(false);
  });

  it("accepts a token from a Casey hostname", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          hostname: "demo.go.caseyhq.co.uk",
        }),
      }),
    );

    await expect(verifyTurnstile("token", "203.0.113.4")).resolves.toBe(true);
  });

  it("rejects a token from another site", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, hostname: "evil.example" }),
      }),
    );

    await expect(verifyTurnstile("token", "203.0.113.4")).resolves.toBe(false);
  });

  it("rejects a localhost token in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, hostname: "localhost" }),
      }),
    );

    await expect(verifyTurnstile("token", "203.0.113.4")).resolves.toBe(false);
  });
});

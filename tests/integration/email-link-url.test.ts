import { describe, expect, it } from "vitest";
import { getEmailLinkURL } from "@/lib/utils";

describe("getEmailLinkURL", () => {
  it("builds a first-party confirm link and keeps the invite code", () => {
    const url = new URL(
      getEmailLinkURL({
        tokenHash: "hash-1",
        type: "magiclink",
        inviteCode: "invite-1",
      }),
    );

    expect(url.pathname).toBe("/auth/confirm");
    expect(url.searchParams.get("token_hash")).toBe("hash-1");
    expect(url.searchParams.get("type")).toBe("magiclink");
    expect(url.searchParams.get("invite")).toBe("invite-1");
    expect(url.hostname).not.toContain("supabase");
  });

  it("omits an empty invite code", () => {
    const url = new URL(
      getEmailLinkURL({
        tokenHash: "hash-2",
        type: "invite",
        inviteCode: "",
      }),
    );

    expect(url.searchParams.get("type")).toBe("invite");
    expect(url.searchParams.has("invite")).toBe(false);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

import { importFresh, readJson } from "./helpers/route-test";

const enforcePersistentRateLimit = vi.fn();
const requireUser = vi.fn();
const SERVERONLY_getStatementWithConfigFromToken = vi.fn();
const SERVERONLY_insertProductFeedback = vi.fn();
const SERVERONLY_hasWitnessSurvey = vi.fn();

vi.mock("@/lib/api-utils", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-utils")>(
    "@/lib/api-utils",
  );
  return {
    ...actual,
    enforcePersistentRateLimit,
    requireUser,
  };
});

vi.mock("@/lib/api-utils/auth", () => ({
  requireUser,
  isAppAdminRequest: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/lib/supabase/queries", () => ({
  SERVERONLY_getStatementWithConfigFromToken,
}));

vi.mock("@/lib/supabase/mutations", () => ({
  SERVERONLY_insertProductFeedback,
  SERVERONLY_hasWitnessSurvey,
}));

const submittedStatement = {
  id: "statement-1",
  tenant_id: "tenant-1",
  status: "submitted" as const,
};

function jsonRequest(url: string, body: unknown, headers?: HeadersInit) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("product feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enforcePersistentRateLimit.mockResolvedValue(null);
    SERVERONLY_insertProductFeedback.mockResolvedValue(undefined);
    SERVERONLY_hasWitnessSurvey.mockResolvedValue(false);
    SERVERONLY_getStatementWithConfigFromToken.mockResolvedValue(
      submittedStatement,
    );
    requireUser.mockResolvedValue({
      userId: "user-1",
      profile: {
        user_id: "user-1",
        tenant_id: "tenant-1",
        role: "solicitor",
        display_name: "Sam Rivers",
      },
    });
  });

  it("rejects witness surveys for unknown tokens", async () => {
    SERVERONLY_getStatementWithConfigFromToken.mockResolvedValue(null);

    const route = await importFresh<
      typeof import("@/app/api/intake/[token]/feedback/route")
    >("@/app/api/intake/[token]/feedback/route");

    const response = await route.POST(
      jsonRequest("http://localhost/api/intake/missing/feedback", {
        rating: 5,
      }),
      { params: Promise.resolve({ token: "missing" }) },
    );

    expect(response.status).toBe(404);
    expect(SERVERONLY_insertProductFeedback).not.toHaveBeenCalled();
  });

  it("does not collect witness surveys on demo intakes", async () => {
    SERVERONLY_getStatementWithConfigFromToken.mockResolvedValue({
      ...submittedStatement,
      status: "demo",
    });

    const route = await importFresh<
      typeof import("@/app/api/intake/[token]/feedback/route")
    >("@/app/api/intake/[token]/feedback/route");

    const response = await route.POST(
      jsonRequest("http://localhost/api/intake/demo/feedback", { rating: 4 }),
      { params: Promise.resolve({ token: "demo" }) },
    );

    expect(response.status).toBe(400);
    expect(SERVERONLY_insertProductFeedback).not.toHaveBeenCalled();
  });

  it("requires a 1-5 rating for witness surveys", async () => {
    const route = await importFresh<
      typeof import("@/app/api/intake/[token]/feedback/route")
    >("@/app/api/intake/[token]/feedback/route");

    const response = await route.POST(
      jsonRequest("http://localhost/api/intake/tok/feedback", {
        message: "unclear",
      }),
      { params: Promise.resolve({ token: "tok" }) },
    );

    expect(response.status).toBe(400);
    expect(SERVERONLY_insertProductFeedback).not.toHaveBeenCalled();
  });

  it("saves a witness survey after statement submit", async () => {
    const route = await importFresh<
      typeof import("@/app/api/intake/[token]/feedback/route")
    >("@/app/api/intake/[token]/feedback/route");

    const response = await route.POST(
      jsonRequest(
        "http://localhost/api/intake/tok/feedback",
        { rating: 5, message: "Straightforward" },
        { "user-agent": "CaseyTest/1.0" },
      ),
      { params: Promise.resolve({ token: "tok" }) },
    );

    expect(response.status).toBe(200);
    expect(SERVERONLY_insertProductFeedback).toHaveBeenCalledWith({
      source: "witness_survey",
      kind: "survey",
      rating: 5,
      message: "Straightforward",
      page_path: "/intake/interview",
      user_agent: "CaseyTest/1.0",
      statement_id: "statement-1",
      tenant_id: "tenant-1",
      submitted_by_user_id: null,
    });
  });

  it("returns 409 when a witness survey already exists", async () => {
    const { userError } = await import("@/lib/api-utils");
    SERVERONLY_insertProductFeedback.mockRejectedValue(
      userError("You've already shared feedback for this statement.", 409, {
        code: "conflict",
      }),
    );

    const route = await importFresh<
      typeof import("@/app/api/intake/[token]/feedback/route")
    >("@/app/api/intake/[token]/feedback/route");

    const response = await route.POST(
      jsonRequest("http://localhost/api/intake/tok/feedback", { rating: 3 }),
      { params: Promise.resolve({ token: "tok" }) },
    );

    expect(response.status).toBe(409);
  });

  it("reports whether a witness survey was already sent", async () => {
    SERVERONLY_hasWitnessSurvey.mockResolvedValue(true);

    const route = await importFresh<
      typeof import("@/app/api/intake/[token]/feedback/route")
    >("@/app/api/intake/[token]/feedback/route");

    const response = await route.GET(
      new Request("http://localhost/api/intake/tok/feedback"),
      { params: Promise.resolve({ token: "tok" }) },
    );

    expect(response.status).toBe(200);
    await expect(readJson(response)).resolves.toEqual({ submitted: true });
  });

  it("requires auth for firm feedback", async () => {
    const { unauthorized } = await import("@/lib/api-utils");
    requireUser.mockRejectedValue(unauthorized());

    const route = await importFresh<
      typeof import("@/app/api/feedback/route")
    >("@/app/api/feedback/route");

    const response = await route.POST(
      jsonRequest("http://localhost/api/feedback", {
        kind: "bug",
        message: "Broken",
      }),
    );

    expect(response.status).toBe(401);
    expect(SERVERONLY_insertProductFeedback).not.toHaveBeenCalled();
  });

  it("requires a description for firm feedback", async () => {
    const route = await importFresh<
      typeof import("@/app/api/feedback/route")
    >("@/app/api/feedback/route");

    const response = await route.POST(
      jsonRequest("http://localhost/api/feedback", {
        kind: "bug",
        message: "   ",
      }),
    );

    expect(response.status).toBe(400);
    expect(SERVERONLY_insertProductFeedback).not.toHaveBeenCalled();
  });

  it("saves firm feedback for signed-in users including app admins", async () => {
    requireUser.mockResolvedValue({
      userId: "admin-1",
      profile: {
        user_id: "admin-1",
        tenant_id: null,
        role: "app_admin",
        display_name: "Uzair",
      },
    });

    const route = await importFresh<
      typeof import("@/app/api/feedback/route")
    >("@/app/api/feedback/route");

    const response = await route.POST(
      jsonRequest("http://localhost/api/feedback", {
        kind: "idea",
        message: "Show assigned cases first",
        pagePath: "/dashboard",
      }),
    );

    expect(response.status).toBe(200);
    expect(SERVERONLY_insertProductFeedback).toHaveBeenCalledWith({
      source: "firm_feedback",
      kind: "idea",
      rating: null,
      message: "Show assigned cases first",
      page_path: "/dashboard",
      user_agent: null,
      statement_id: null,
      tenant_id: null,
      submitted_by_user_id: "admin-1",
    });
  });
});

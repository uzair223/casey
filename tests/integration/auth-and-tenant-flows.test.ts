import { beforeEach, describe, expect, it, vi } from "vitest";

import { importFresh, readJson } from "./helpers/route-test";

const enforceRateLimit = vi.fn();
const getRateLimitKey = vi.fn();
const enforcePersistentRateLimit = vi.fn();
const sendInvitationEmail = vi.fn();
const getServiceClient = vi.fn();
const SERVERONLY_acceptInvite = vi.fn();
const SERVERONLY_getUserProfile = vi.fn();
const SERVERONLY_getTeamMembers = vi.fn();
const logAuditEvent = vi.fn();

vi.mock("@/lib/api-utils/rate-limit", () => ({
  enforceRateLimit,
  getRateLimitKey,
}));

vi.mock("@/lib/api-utils", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-utils")>(
    "@/lib/api-utils",
  );
  return {
    ...actual,
    enforcePersistentRateLimit,
  };
});

vi.mock("@/lib/email", () => ({
  sendInvitationEmail,
}));

vi.mock("@/lib/supabase/server", () => ({
  getServiceClient,
}));

vi.mock("@/lib/supabase/mutations", () => ({
  SERVERONLY_acceptInvite,
}));

vi.mock("@/lib/supabase/queries", () => ({
  SERVERONLY_getUserProfile,
  SERVERONLY_getTeamMembers,
}));

vi.mock("@/lib/observability/audit", () => ({
  logAuditEvent,
}));

type QueryBuilder = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  then?: <TResult1 = unknown, TResult2 = never>(
    onfulfilled?:
      | ((value: {
          data?: unknown;
          error: unknown;
          count?: number | null;
        }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?:
      | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
      | null,
  ) => Promise<TResult1 | TResult2>;
};

function createSupabaseMock(options?: {
  getUserResult?: { data: { user: { id: string; email?: string } | null }; error: unknown };
  fromHandlers?: Record<string, QueryBuilder>;
  rpcResult?: unknown;
}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue(
        options?.getUserResult ?? {
          data: { user: { id: "user-1", email: "user@example.com" } },
          error: null,
        },
      ),
    },
    from: vi.fn((table: string) => {
      const handler = options?.fromHandlers?.[table];
      if (!handler) {
        throw new Error(`Missing mock for table ${table}`);
      }
      return handler;
    }),
    rpc: vi.fn().mockResolvedValue(options?.rpcResult ?? { error: null }),
  };
}

function createQueryBuilder(result: {
  maybeSingle?: unknown;
  single?: unknown;
  update?: unknown;
  delete?: unknown;
  count?: number | null;
  select?: unknown;
}) {
  let awaitedResult =
    (result.select as { data?: unknown; error: unknown; count?: number | null }) ??
    { data: null, error: null, count: result.count ?? null };
  const maybeSingle = vi.fn().mockResolvedValue(
    result.maybeSingle ?? { data: null, error: null },
  );
  const single = vi.fn().mockResolvedValue(
    result.single ?? result.maybeSingle ?? { data: null, error: null },
  );
  const builder: QueryBuilder = {
    select: vi.fn(function (this: QueryBuilder) {
      awaitedResult =
        (result.select as { data?: unknown; error: unknown; count?: number | null }) ??
        { data: null, error: null, count: result.count ?? null };
      return this as QueryBuilder;
    }),
    eq: vi.fn().mockReturnThis(),
    maybeSingle,
    single,
    update: vi.fn(function (this: QueryBuilder) {
      awaitedResult =
        (result.update as { data?: unknown; error: unknown; count?: number | null }) ??
        { error: null, count: result.count ?? null };
      return this as QueryBuilder;
    }),
    delete: vi.fn(function (this: QueryBuilder) {
      awaitedResult =
        (result.delete as { data?: unknown; error: unknown; count?: number | null }) ??
        { error: null, count: result.count ?? null };
      return this as QueryBuilder;
    }),
    then(onfulfilled, onrejected) {
      return Promise.resolve(awaitedResult).then(onfulfilled, onrejected);
    },
  };

  return builder;
}

describe("authentication and tenant flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enforceRateLimit.mockReturnValue({ ok: true });
    getRateLimitKey.mockReturnValue("rate-key");
    enforcePersistentRateLimit.mockResolvedValue(null);
  });

  it("accepts waitlist signups", async () => {
    const waitlistTable = {
      upsert: vi.fn().mockResolvedValue({ error: null }),
    };
    getServiceClient.mockReturnValue({
      from: vi.fn((table: string) => {
        expect(table).toBe("waitlist_signups");
        return waitlistTable;
      }),
    });

    const route = await importFresh<
      typeof import("@/app/api/waitlist/route")
    >("@/app/api/waitlist/route");

    const response = await route.POST(
      new Request("http://localhost/api/waitlist", {
        method: "POST",
        body: JSON.stringify({
          name: "Casey",
          companyName: "Law Co",
          email: "casey@law.co.uk",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(200);
    expect(waitlistTable.upsert).toHaveBeenCalledWith(
      {
        full_name: "Casey",
        company_name: "Law Co",
        email: "casey@law.co.uk",
      },
      { onConflict: "email" },
    );
  });

  it("sends a magic link when the request is valid", async () => {
    const invites = createQueryBuilder({
      maybeSingle: {
        data: {
          email: "witness@firm.co.uk",
          accepted_at: null,
          expires_at: "2099-01-01T00:00:00.000Z",
        },
        error: null,
      },
    });

    getServiceClient.mockReturnValue(
      createSupabaseMock({
        fromHandlers: {
          invites,
        },
      }),
    );

    const route = await importFresh<
      typeof import("@/app/api/auth/magic-link/route")
    >("@/app/api/auth/magic-link/route");

    const response = await route.POST(
      new Request("http://localhost/api/auth/magic-link", {
        method: "POST",
        body: JSON.stringify({
          email: "witness@firm.co.uk",
          inviteCode: "invite-123",
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(200);
    expect(sendInvitationEmail).toHaveBeenCalledWith({
      email: "witness@firm.co.uk",
      token: "invite-123",
    });
  });

  it("surfaces invite details for an authenticated recipient", async () => {
    const invites = createQueryBuilder({
      maybeSingle: {
        data: {
          token: "invite-token",
          email: "user@example.com",
          tenant_id: "tenant-1",
          role: "solicitor",
          expires_at: "2099-01-01T00:00:00.000Z",
          accepted_at: null,
        },
        error: null,
      },
    });
    const profiles = createQueryBuilder({
      maybeSingle: {
        data: { role: "paralegal", tenant_id: "tenant-1" },
        error: null,
      },
    });
    const tenants = createQueryBuilder({
      maybeSingle: { data: { name: "Tenant Alpha" }, error: null },
    });

    getServiceClient.mockReturnValue(
      createSupabaseMock({
        fromHandlers: {
          profiles,
          invites,
          tenants,
        },
      }),
    );

    const route = await importFresh<
      typeof import("@/app/api/invites/accept/[token]/route")
    >("@/app/api/invites/accept/[token]/route");

    const response = await route.GET(
      new Request("http://localhost/api/invites/accept/invite-token", {
        headers: { authorization: "Bearer token-1" },
      }),
      { params: Promise.resolve({ token: "invite-token" }) },
    );

    expect(response.status).toBe(200);
    await expect(readJson<{ invite: { tenant_name: string } }>(response)).resolves
      .toMatchObject({
        invite: { tenant_name: "Tenant Alpha" },
      });
  });

  it("requires a firm name when accepting a new tenant admin invite", async () => {
    const invites = createQueryBuilder({
      maybeSingle: {
        data: {
          token: "invite-token",
          email: "user@example.com",
          tenant_id: null,
          role: "tenant_admin",
          expires_at: "2099-01-01T00:00:00.000Z",
          accepted_at: null,
        },
        error: null,
      },
    });
    const profiles = createQueryBuilder({
      maybeSingle: {
        data: { role: "user", tenant_id: null },
        error: null,
      },
    });

    getServiceClient.mockReturnValue(
      createSupabaseMock({
        fromHandlers: {
          profiles,
          invites,
        },
      }),
    );

    const route = await importFresh<
      typeof import("@/app/api/invites/accept/[token]/route")
    >("@/app/api/invites/accept/[token]/route");

    const response = await route.POST(
      new Request("http://localhost/api/invites/accept/invite-token", {
        method: "POST",
        headers: {
          authorization: "Bearer token-1",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ displayName: "Casey User" }),
      }),
      { params: Promise.resolve({ token: "invite-token" }) },
    );

    expect(response.status).toBe(400);
    expect(SERVERONLY_acceptInvite).not.toHaveBeenCalled();
  });

  it("returns soft-delete lifecycle details and restore eligibility", async () => {
    SERVERONLY_getUserProfile.mockResolvedValue({
      role: "tenant_admin",
      tenant_id: "tenant-1",
    });

    const tenants = createQueryBuilder({
      maybeSingle: {
        data: {
          id: "tenant-1",
          name: "Tenant Alpha",
          soft_deleted_at: "2026-04-20T10:00:00.000Z",
          soft_deleted_by_role: "tenant_admin",
          purge_after: "2099-05-01T00:00:00.000Z",
        },
        error: null,
      },
    });

    getServiceClient.mockReturnValue(
      createSupabaseMock({
        fromHandlers: {
          tenants,
        },
      }),
    );

    const route = await importFresh<
      typeof import("@/app/api/tenant/lifecycle/route")
    >("@/app/api/tenant/lifecycle/route");

    const response = await route.GET(
      new Request("http://localhost/api/tenant/lifecycle", {
        headers: { authorization: "Bearer token-1" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(
      readJson<{ softDeleted: boolean; canRestore: boolean }>(response),
    ).resolves.toEqual(
      expect.objectContaining({
        softDeleted: true,
        canRestore: true,
      }),
    );
  });

  it("restores an archived tenant when the tenant admin requests it", async () => {
    SERVERONLY_getUserProfile.mockResolvedValue({
      role: "tenant_admin",
      tenant_id: "tenant-1",
    });

    const tenants = createQueryBuilder({
      maybeSingle: {
        data: {
          id: "tenant-1",
          soft_deleted_at: "2026-04-20T10:00:00.000Z",
          soft_deleted_by_role: "tenant_admin",
          purge_after: "2099-05-01T00:00:00.000Z",
        },
        error: null,
      },
    });

    const supabase = createSupabaseMock({
      fromHandlers: {
        tenants,
      },
    });
    getServiceClient.mockReturnValue(supabase);

    const route = await importFresh<
      typeof import("@/app/api/tenant/lifecycle/route")
    >("@/app/api/tenant/lifecycle/route");

    const response = await route.POST(
      new Request("http://localhost/api/tenant/lifecycle", {
        method: "POST",
        headers: { authorization: "Bearer token-1" },
      }),
    );

    expect(response.status).toBe(200);
    expect(supabase.rpc).toHaveBeenCalledWith("restore_tenant", {
      tenant_id_param: "tenant-1",
    });
  });

  it("lists team members for tenant users", async () => {
    SERVERONLY_getUserProfile.mockResolvedValue({
      role: "tenant_admin",
      tenant_id: "tenant-1",
    });
    SERVERONLY_getTeamMembers.mockResolvedValue([
      { user_id: "u-1", display_name: "Casey" },
    ]);
    getServiceClient.mockReturnValue(createSupabaseMock());

    const route = await importFresh<
      typeof import("@/app/api/tenant/members/route")
    >("@/app/api/tenant/members/route");

    const response = await route.GET(
      new Request("http://localhost/api/tenant/members", {
        headers: { authorization: "Bearer token-1" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(readJson<{ members: Array<{ user_id: string }> }>(response))
      .resolves.toEqual({
        members: [{ user_id: "u-1", display_name: "Casey" }],
      });
  });

  it("prevents removing the final tenant admin role", async () => {
    SERVERONLY_getUserProfile.mockResolvedValue({
      role: "tenant_admin",
      tenant_id: "tenant-1",
    });

    const profiles = createQueryBuilder({
      maybeSingle: {
        data: { tenant_id: "tenant-1", role: "tenant_admin" },
        error: null,
      },
      select: { count: 1, error: null },
    });

    getServiceClient.mockReturnValue(
      createSupabaseMock({
        fromHandlers: {
          profiles,
        },
      }),
    );

    const route = await importFresh<
      typeof import("@/app/api/tenant/members/route")
    >("@/app/api/tenant/members/route");

    const response = await route.PUT(
      new Request("http://localhost/api/tenant/members", {
        method: "PUT",
        headers: {
          authorization: "Bearer token-1",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: "11111111-1111-4111-8111-111111111111",
          role: "solicitor",
        }),
      }),
    );

    expect(response.status).toBe(409);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

import { importFresh, readJson, readText } from "./helpers/route-test";

const requireTenantUser = vi.fn();
const getServiceClient = vi.fn();
const SERVERONLY_getMentionNotificationDispatchContext = vi.fn();
const SERVERONLY_getUserProfile = vi.fn();
const sendMentionNotificationEmail = vi.fn();
const logAuditEvent = vi.fn();

vi.mock("@/lib/api-utils/auth", () => ({
  requireTenantUser,
  getBearerToken: (request: Request) =>
    request.headers.get("authorization")?.replace("Bearer ", "") ?? null,
}));

vi.mock("@/lib/supabase/server", () => ({
  getServiceClient,
}));

vi.mock("@/lib/supabase/queries", () => ({
  SERVERONLY_getMentionNotificationDispatchContext,
  SERVERONLY_getUserProfile,
}));

vi.mock("@/lib/email", () => ({
  sendMentionNotificationEmail,
}));

vi.mock("@/lib/observability/audit", () => ({
  logAuditEvent,
}));

function createAwaitableBuilder(result: unknown) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    delete: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    then(onfulfilled: (value: unknown) => unknown, onrejected?: (reason: unknown) => unknown) {
      return Promise.resolve(result).then(onfulfilled, onrejected);
    },
  };

  return builder;
}

describe("compliance and notification flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("emails mentioned users when mention notifications are enabled", async () => {
    requireTenantUser.mockResolvedValue({
      tenantId: "tenant-1",
      userId: "user-1",
    });
    SERVERONLY_getMentionNotificationDispatchContext.mockResolvedValue({
      tenantId: "tenant-1",
      tenantName: "Tenant Alpha",
      actorName: "Casey Solicitor",
      caseTitle: "Accident claim",
      noteType: "statement note",
      noteExcerpt: "Please check paragraph 4",
      linkPath: "/cases/case-1?statement=statement-1",
      mentionedUserIds: ["user-2", "user-3", "user-2"],
    });

    const preferences = createAwaitableBuilder({
      data: { mention_channel: "email" },
      error: null,
    });
    getServiceClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "tenant_notification_preferences") {
          return preferences;
        }
        throw new Error(`Unexpected table ${table}`);
      }),
      auth: {
        admin: {
          getUserById: vi
            .fn()
            .mockResolvedValueOnce({
              data: { user: { email: "a@firm.test" } },
            })
            .mockResolvedValueOnce({
              data: { user: { email: "b@firm.test" } },
            })
            .mockResolvedValueOnce({
              data: { user: { email: "a@firm.test" } },
            }),
        },
      },
    });

    const route = await importFresh<
      typeof import("@/app/api/notifications/mentions/route")
    >("@/app/api/notifications/mentions/route");

    const response = await route.POST(
      new Request("http://localhost/api/notifications/mentions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "statement", noteId: "note-1" }),
      }) as never,
    );

    expect(response.status).toBe(200);
    expect(sendMentionNotificationEmail).toHaveBeenCalledTimes(2);
    await expect(readJson<{ ok: boolean; sent: number }>(response)).resolves.toEqual({
      ok: true,
      sent: 2,
    });
  });

  it("generates a DSAR export for the current user", async () => {
    const auditLogs = createAwaitableBuilder({ data: [{ id: "audit-1" }], error: null });
    const deletionRequests = createAwaitableBuilder({
      data: [{ id: "deletion-1" }],
      error: null,
    });
    const invites = createAwaitableBuilder({ data: [{ id: "invite-1" }], error: null });
    const cases = createAwaitableBuilder({ data: [{ id: "case-1" }], error: null });
    const statements = createAwaitableBuilder({
      data: [{ id: "statement-1" }],
      error: null,
    });

    SERVERONLY_getUserProfile.mockResolvedValue({
      role: "solicitor",
      tenant_id: "tenant-1",
      tenant_name: "Tenant Alpha",
      display_name: "Casey Solicitor",
    });

    getServiceClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1", email: "solicitor@firm.test" } },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === "audit_logs") return auditLogs;
        if (table === "account_deletion_requests") return deletionRequests;
        if (table === "invites") return invites;
        if (table === "cases") return cases;
        if (table === "statements") return statements;
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const route = await importFresh<
      typeof import("@/app/api/dsar/export/route")
    >("@/app/api/dsar/export/route");

    const response = await route.GET(
      new Request("http://localhost/api/dsar/export?scope=user", {
        headers: { authorization: "Bearer token-1" },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toContain("dsar-user-user-1");
    await expect(readText(response)).resolves.toContain("\"statement-1\"");
    expect(logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "dsar.export.generated",
        targetType: "user",
      }),
    );
  });

  it("blocks self-deletion for the final tenant admin", async () => {
    SERVERONLY_getUserProfile.mockResolvedValue({
      role: "tenant_admin",
      tenant_id: "tenant-1",
    });

    const profiles = createAwaitableBuilder({ count: 1, error: null });
    getServiceClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
        admin: {
          deleteUser: vi.fn(),
        },
      },
      from: vi.fn((table: string) => {
        if (table === "profiles") return profiles;
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const route = await importFresh<
      typeof import("@/app/api/profile/route")
    >("@/app/api/profile/route");

    const response = await route.DELETE(
      new Request("http://localhost/api/profile", {
        method: "DELETE",
        headers: { authorization: "Bearer token-1" },
      }),
    );

    expect(response.status).toBe(409);
  });

  it("rejects an account deletion request when reviewed by an authorized admin", async () => {
    SERVERONLY_getUserProfile.mockResolvedValue({
      role: "tenant_admin",
      tenant_id: "tenant-1",
    });

    const deletionRequests = createAwaitableBuilder({
      data: {
        id: "11111111-1111-4111-8111-111111111111",
        status: "pending",
        tenant_id: "tenant-1",
        requested_user_id: "user-2",
      },
      error: null,
    });

    getServiceClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
        admin: {
          deleteUser: vi.fn(),
        },
      },
      from: vi.fn((table: string) => {
        if (table === "account_deletion_requests") return deletionRequests;
        if (table === "profiles") {
          return createAwaitableBuilder({
            data: { role: "solicitor", tenant_id: "tenant-1" },
            error: null,
          });
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const route = await importFresh<
      typeof import("@/app/api/account-deletion-requests/route")
    >("@/app/api/account-deletion-requests/route");

    const response = await route.PATCH(
      new Request("http://localhost/api/account-deletion-requests", {
        method: "PATCH",
        headers: {
          authorization: "Bearer token-1",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: "11111111-1111-4111-8111-111111111111",
          action: "reject",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "account_deletion.rejected",
        targetId: "user-2",
      }),
    );
  });
});

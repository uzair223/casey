import { beforeEach, describe, expect, it, vi } from "vitest";

import { importFresh, readJson } from "./helpers/route-test";

const SERVERONLY_getStatementWithConfigFromToken = vi.fn();
const SERVERONLY_getFullStatementFromToken = vi.fn();
const SERVERONLY_submitStatement = vi.fn();
const SERVERONLY_createUserNotifications = vi.fn();
const SERVERONLY_updateStatementByToken = vi.fn();
const SERVERONLY_updateStatementStatus = vi.fn();
const SERVERONLY_getStatementSubmissionNotificationRecipients = vi.fn();
const getIntakeAccessError = vi.fn();
const sendStatementSubmittedNotificationEmail = vi.fn();
const getServiceClient = vi.fn();
const signDoc = vi.fn();

vi.mock("@/lib/supabase/queries", () => ({
  SERVERONLY_getStatementWithConfigFromToken,
  SERVERONLY_getFullStatementFromToken,
  SERVERONLY_getStatementSubmissionNotificationRecipients,
}));

vi.mock("@/lib/supabase/mutations", () => ({
  SERVERONLY_submitStatement,
  SERVERONLY_createUserNotifications,
  SERVERONLY_updateStatementByToken,
  SERVERONLY_updateStatementStatus,
}));

vi.mock("@/lib/api-utils/intake-access", () => ({
  getIntakeAccessError,
}));

vi.mock("@/lib/email", () => ({
  sendStatementSubmittedNotificationEmail,
}));

vi.mock("@/lib/supabase/server", () => ({
  getServiceClient,
}));

vi.mock("@/lib/doc-gen", () => ({
  signDoc,
}));

describe("intake submission and final review flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getIntakeAccessError.mockResolvedValue(null);
  });

  it("submits a witness statement and notifies the legal team", async () => {
    SERVERONLY_getStatementWithConfigFromToken.mockResolvedValue({
      id: "statement-1",
      case_id: "case-1",
      tenant_id: "tenant-1",
      title: "Accident claim",
      witness_name: "Casey Witness",
      supporting_documents: [],
      status: "in_progress",
    });
    SERVERONLY_submitStatement.mockResolvedValue("statement-1");
    SERVERONLY_getStatementSubmissionNotificationRecipients.mockResolvedValue({
      tenantId: "tenant-1",
      tenantName: "Tenant Alpha",
      statementId: "statement-1",
      caseId: "case-1",
      statementTitle: "Accident claim",
      witnessName: "Casey Witness",
      recipientUserIds: ["user-1"],
      recipientEmails: ["solicitor@firm.co.uk"],
    });
    getServiceClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { submissions_channel: "email" },
          error: null,
        }),
      })),
    });

    const route = await importFresh<
      typeof import("@/app/api/intake/[token]/interview/submit/route")
    >("@/app/api/intake/[token]/interview/submit/route");

    const response = await route.POST(
      new Request("http://localhost/api/intake/token-1/interview/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signedDocument: {
            name: "statement.docx",
            path: "cases/case-1/statement-1/submitted/statement.docx",
            bucketId: "tenant-1",
            type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            uploadedAt: "2026-04-23T12:00:00.000Z",
          },
        }),
      }),
      { params: Promise.resolve({ token: "token-1" }) },
    );

    expect(response.status).toBe(200);
    expect(SERVERONLY_submitStatement).toHaveBeenCalled();
    expect(SERVERONLY_createUserNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        notificationType: "statement_submitted_for_review",
        entityId: "statement-1",
      }),
    );
    expect(sendStatementSubmittedNotificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["solicitor@firm.co.uk"],
        witnessName: "Casey Witness",
      }),
    );
  });

  it("keeps witness details read-only once a statement reaches final review", async () => {
    SERVERONLY_getStatementWithConfigFromToken.mockResolvedValue({
      id: "statement-1",
      status: "finalized",
    });

    const route = await importFresh<
      typeof import("@/app/api/intake/[token]/interview/submit/route")
    >("@/app/api/intake/[token]/interview/submit/route");

    const response = await route.PUT(
      new Request("http://localhost/api/intake/token-1/interview/submit", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          witnessDetails: { occupation: "Driver" },
        }),
      }),
      { params: Promise.resolve({ token: "token-1" }) },
    );

    expect(response.status).toBe(409);
    expect(SERVERONLY_updateStatementByToken).not.toHaveBeenCalled();
  });

  it("signs and completes a finalized statement during final review", async () => {
    SERVERONLY_getFullStatementFromToken.mockResolvedValue({
      tenant_id: "tenant-1",
      case: {
        id: "case-1",
        title: "Accident claim",
      },
      statement: {
        id: "statement-1",
        status: "finalized",
        witness_name: "Casey Witness",
        signed_document: {
          bucketId: "tenant-1",
          name: "statement.docx",
          path: "cases/case-1/statement-1/submitted/statement.docx",
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          uploadedAt: "2026-04-23T12:00:00.000Z",
        },
        supporting_documents: [],
      },
    });
    signDoc.mockResolvedValue(
      new Blob(["signed"], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    );

    const storageBucket = {
      download: vi
        .fn()
        .mockResolvedValueOnce({
          data: new Blob(["document"], {
            type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          }),
          error: null,
        }),
      upload: vi.fn().mockResolvedValue({
        data: { path: "docs/final-signed.docx" },
        error: null,
      }),
    };

    getServiceClient.mockReturnValue({
      storage: {
        from: vi.fn(() => storageBucket),
      },
    });

    const route = await importFresh<
      typeof import("@/app/api/intake/[token]/final-review/route")
    >("@/app/api/intake/[token]/final-review/route");

    const response = await route.POST(
      new Request("http://localhost/api/intake/token-1/final-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signatureImageDataUrl:
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/w8AAgMBgN4XvGkAAAAASUVORK5CYII=",
          signatureName: "Casey Witness",
        }),
      }),
      { params: Promise.resolve({ token: "token-1" }) },
    );

    expect(response.status).toBe(200);
    expect(signDoc).toHaveBeenCalled();
    expect(SERVERONLY_updateStatementByToken).toHaveBeenCalledWith(
      "token-1",
      expect.objectContaining({
        witness_metadata: { final_signature_name: "Casey Witness" },
      }),
    );
    expect(SERVERONLY_updateStatementStatus).toHaveBeenCalledWith(
      "statement-1",
      "completed",
    );
    await expect(readJson<{ ok: boolean }>(response)).resolves.toEqual({
      ok: true,
    });
  });
});

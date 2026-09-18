import { beforeEach, describe, expect, it, vi } from "vitest";

import { importFresh, readJson, readStream } from "./helpers/route-test";

const requireAppAdmin = vi.fn();
const requireUser = vi.fn();
const SERVERONLY_getDemoStudioBootstrapOptions = vi.fn();
const SERVERONLY_createDemoStudioStatement = vi.fn();
const SERVERONLY_listDemoStudioStatements = vi.fn();
const logServerEvent = vi.fn();
const getSystemConfig = vi.fn();
const setSystemConfig = vi.fn();
const chatCompletionsCreate = vi.fn();
const docxReviewerFromBuffer = vi.fn();

vi.mock("@/lib/api-utils/auth", () => ({
  requireAppAdmin,
  requireUser,
}));

vi.mock("@/lib/supabase/queries", () => ({
  SERVERONLY_getDemoStudioBootstrapOptions,
  SERVERONLY_listDemoStudioStatements,
}));

vi.mock("@/lib/supabase/mutations", () => ({
  SERVERONLY_createDemoStudioStatement,
}));

vi.mock("@/lib/observability/logger", () => ({
  logServerEvent,
}));

vi.mock("@/lib/env", () => ({
  env: {
    CLOUDFLARE_AI_ACCOUNT_ID: "test-account",
    CLOUDFLARE_AI_API_TOKEN: "test-token",
    CLOUDFLARE_AI_GATEWAY_ID: "default",
    CRON_SECRET: "cron-secret",
  },
}));

vi.mock("@/lib/supabase/system-config", () => ({
  getSystemConfig,
  setSystemConfig,
  isSystemConfigKey: (key: string) =>
    ["cron_secret", "site_url", "default_chat_system_prompt"].includes(key),
}));

vi.mock("openai", () => ({
  default: class OpenAI {
    chat = {
      completions: {
        create: chatCompletionsCreate,
      },
    };
  },
}));

vi.mock("openai/helpers/zod.mjs", () => ({
  zodResponseFormat: vi.fn(() => ({ type: "json_schema" })),
}));

vi.mock("@eigenpal/docx-editor-agents", () => ({
  DocxReviewer: {
    fromBuffer: docxReviewerFromBuffer,
  },
}));

async function* streamChunks(parts: string[]) {
  for (const part of parts) {
    yield {
      choices: [{ delta: { content: part } }],
    };
  }
}

describe("admin and AI-assisted flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAppAdmin.mockResolvedValue({ userId: "admin-1" });
    requireUser.mockResolvedValue({ userId: "user-1" });
  });

  it("rejects unauthenticated system-config reads", async () => {
    const { unauthorized } = await import("@/lib/api-utils");
    requireAppAdmin.mockRejectedValue(unauthorized());

    const route = await importFresh<
      typeof import("@/app/api/admin/system-config/[key]/route")
    >("@/app/api/admin/system-config/[key]/route");

    const response = await route.GET(
      new Request("https://casey.test/api/admin/system-config/cron_secret"),
      { params: Promise.resolve({ key: "cron_secret" }) },
    );

    expect(response.status).toBe(401);
    expect(getSystemConfig).not.toHaveBeenCalled();
  });

  it("redacts cron_secret values for authenticated admins", async () => {
    getSystemConfig.mockResolvedValue("super-secret");

    const route = await importFresh<
      typeof import("@/app/api/admin/system-config/[key]/route")
    >("@/app/api/admin/system-config/[key]/route");

    const response = await route.GET(
      new Request("https://casey.test/api/admin/system-config/cron_secret"),
      { params: Promise.resolve({ key: "cron_secret" }) },
    );

    expect(response.status).toBe(200);
    await expect(readJson<{ configured: boolean; value?: string }>(response))
      .resolves.toEqual({
        key: "cron_secret",
        configured: true,
      });
  });

  it("rejects unauthenticated AI worker runs", async () => {
    const route = await importFresh<
      typeof import("@/app/api/internal/workers/statement-formalization/route")
    >("@/app/api/internal/workers/statement-formalization/route");

    const response = await route.POST(
      new Request(
        "https://casey.test/api/internal/workers/statement-formalization",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: "job-1" }),
        },
      ),
    );

    expect(response.status).toBe(401);
  });

  it("bootstraps a demo statement and returns an intake URL", async () => {
    SERVERONLY_createDemoStudioStatement.mockResolvedValue({
      tenant: { id: "tenant-1" },
      case: { id: "case-1" },
      statement: { id: "statement-1" },
      magicLink: {
        token: "demo-token",
        expiresAt: "2099-01-01T00:00:00.000Z",
      },
    });

    const route = await importFresh<
      typeof import("@/app/api/admin/demo-studio/bootstrap/route")
    >("@/app/api/admin/demo-studio/bootstrap/route");

    const response = await route.POST(
      new Request("https://casey.test/api/admin/demo-studio/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantName: "Demo Tenant",
          witnessName: "Casey Witness",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(
      readJson<{ magicLink: { intakeUrl: string } }>(response),
    ).resolves.toEqual(
      expect.objectContaining({
        magicLink: {
          token: "demo-token",
          expiresAt: "2099-01-01T00:00:00.000Z",
          intakeUrl: "https://casey.test/intake/demo-token",
        },
      }),
    );
  });

  it("lists demo studio statements with resolved intake URLs", async () => {
    SERVERONLY_listDemoStudioStatements.mockResolvedValue([
      {
        id: "statement-1",
        magic_link_token: "demo-token",
      },
    ]);

    const route = await importFresh<
      typeof import("@/app/api/admin/demo-studio/statements/route")
    >("@/app/api/admin/demo-studio/statements/route");

    const response = await route.GET(
      new Request("https://casey.test/api/admin/demo-studio/statements"),
    );

    expect(response.status).toBe(200);
    await expect(
      readJson<{ statements: Array<{ intake_url: string }> }>(response),
    ).resolves.toEqual({
      statements: [
        {
          id: "statement-1",
          magic_link_token: "demo-token",
          intake_url: "https://casey.test/intake/demo-token",
        },
      ],
    });
  });

  it("streams AI-generated config updates as NDJSON", async () => {
    chatCompletionsCreate.mockResolvedValue(
      streamChunks([
        '{"kind":"patch","message":"Drafting","data":{"name":"',
        'Accident Template"}}',
      ]),
    );

    const route = await importFresh<
      typeof import("@/app/api/generate/config/route")
    >("@/app/api/generate/config/route");

    const response = await route.POST(
      new Request("http://localhost/api/generate/config", {
        method: "POST",
        headers: {
          authorization: "Bearer token-1",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: "Create a template for an accident claim",
          conversationHistory: [],
          responseFormat: {
            type: "json_schema",
            json_schema: { name: "template_patch" },
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(readStream(response)).resolves.toContain(
      '{"kind":"patch","message":"Drafting","data":{"name":"Accident Template"}}',
    );
  });

  it("reviews a DOCX buffer and returns an edited file summary", async () => {
    chatCompletionsCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              generatedResponse: "I tightened the wording in paragraph 0.",
              comments: [
                {
                  paragraphIndex: 0,
                  text: "Consider a clearer incident date.",
                  rangeStart: 0,
                  rangeEnd: 10,
                },
              ],
              proposals: [
                {
                  paragraphIndex: 0,
                  oldText: "was hurt",
                  newText: "sustained injury",
                  rangeStart: 11,
                  rangeEnd: 19,
                },
              ],
            }),
          },
        },
      ],
    });

    const reviewer = {
      getContentAsText: vi.fn().mockReturnValue("[0] The witness was hurt."),
      applyReview: vi.fn(),
      toBuffer: vi
        .fn()
        .mockResolvedValue(new Uint8Array([1, 2, 3]).buffer),
    };
    docxReviewerFromBuffer.mockResolvedValue(reviewer);

    const route = await importFresh<
      typeof import("@/app/api/generate/docx-review/route")
    >("@/app/api/generate/docx-review/route");

    const response = await route.POST(
      new Request("http://localhost/api/generate/docx-review", {
        method: "POST",
        headers: {
          authorization: "Bearer token-1",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bufferBase64: Buffer.from("fake-docx").toString("base64"),
          reviewGoal: "Make it more professional",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(reviewer.applyReview).toHaveBeenCalledWith({
      comments: [
        {
          paragraphIndex: 0,
          text: "Consider a clearer incident date.",
        },
      ],
      proposals: [
        {
          paragraphIndex: 0,
          search: "was hurt",
          replaceWith: "sustained injury",
        },
      ],
    });
    await expect(
      readJson<{ summary: { generatedResponse: string } }>(response),
    ).resolves.toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({
          generatedResponse: "I tightened the wording in paragraph 0.",
        }),
      }),
    );
  });
});

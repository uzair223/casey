import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect } from "vitest";
import type { Database } from "@/types";

type AnyFn = (...args: unknown[]) => unknown;

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL;
if (PUBLISHABLE_KEY) {
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = PUBLISHABLE_KEY;
}
process.env.RESEND_API_KEY ??= "re_test_key";
process.env.RESEND_FROM ??= "Casey Test <noreply@example.com>";

function createPublishableClient() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    throw new Error(
      "Missing Supabase URL/publishable key for connected integration tests",
    );
  }

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function makeGenericPayload() {
  const id = randomUUID();
  return {
    id,
    token: randomUUID(),
    tenantId: randomUUID(),
    caseId: randomUUID(),
    statementId: randomUUID(),
    messageId: randomUUID(),
    userId: randomUUID(),
    role: "solicitor",
    email: `user+${id}@example.com`,
    displayName: "Connected Integration User",
    firmName: "Connected Integration Firm",
    title: "Connected Integration Title",
    body: "Connected Integration Body",
    status: "draft",
    dataRetentionDays: 365,
    name: "Connected Integration Name",
    path: `uploads/${id}.txt`,
    bucketId: randomUUID(),
    documentId: randomUUID(),
    uploadedByUserId: randomUUID(),
    supportingDocuments: [],
    sections: [],
    dueAt: new Date(Date.now() + 86_400_000).toISOString(),
    document: {
      bucketId: randomUUID(),
      path: `internal/${id}.pdf`,
      filename: "test.pdf",
      name: "Test Document",
    },
    signedDocument: {
      bucketId: randomUUID(),
      path: `signed/${id}.pdf`,
      filename: "signed.pdf",
    },
  };
}

function buildArgs(functionName: string, arity: number): unknown[] {
  const payload = makeGenericPayload();

  if (functionName === "setCaseTemplateStatementTemplates") {
    return [
      {
        caseTemplateId: payload.id,
        statementTemplateIds: [randomUUID()],
        defaultStatementTemplateId: null,
      },
    ];
  }

  if (functionName === "createInvite") {
    return [payload.email, "solicitor", payload.tenantId, payload.userId, 7];
  }

  if (functionName === "updateCurrentUserProfile") {
    return [payload.userId, payload.displayName];
  }

  if (functionName === "SERVERONLY_getMentionNotificationDispatchContext") {
    return ["case", payload.id];
  }

  if (functionName === "exactCount") {
    return [createPublishableClient(), "tenants"];
  }

  if (functionName === "syncCaseStatusFromWitnesses") {
    return [payload.caseId, createPublishableClient()];
  }

  if (functionName === "uploadFile") {
    return [
      {
        bucketId: payload.bucketId,
        name: "integration-upload.txt",
        path: payload.path,
        file: new Blob(["connected-upload-test"]),
        contentType: "text/plain",
        description: "connected integration test",
      },
    ];
  }

  if (functionName === "downloadUploadedDocument") {
    return [
      {
        bucketId: payload.bucketId,
        path: payload.path,
        name: "integration-upload.txt",
        uploadedAt: new Date().toISOString(),
        type: "text/plain",
      },
    ];
  }

  if (arity <= 0) {
    return [];
  }

  const tokens = [
    payload.id,
    payload.tenantId,
    payload.caseId,
    payload.statementId,
    payload.messageId,
    payload.userId,
  ];

  const args: unknown[] = [];
  for (let i = 0; i < arity; i += 1) {
    if (i === 0) {
      if (
        /create|update|set|upsert|save|submit|publish|restore|delete|rename/i.test(
          functionName,
        )
      ) {
        args.push(payload);
      } else {
        args.push(tokens[0]);
      }
      continue;
    }

    if (i === 1 && /Role|status/i.test(functionName)) {
      args.push("solicitor");
      continue;
    }

    if (i === 1 && /upload|file|document/i.test(functionName)) {
      args.push(new Blob(["connected-file"]));
      continue;
    }

    args.push(tokens[i] ?? payload);
  }

  return args;
}

function isExpectedIntegrationError(error: unknown): boolean {
  if (
    typeof error === "object" &&
    error !== null &&
    ("code" in error ||
      "error" in error ||
      "error_description" in error ||
      "details" in error ||
      "hint" in error)
  ) {
    return true;
  }

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null
        ? String(
            (error as { message?: unknown }).message ?? JSON.stringify(error),
          )
        : String(error);

  return /permission|violates row-level security|invalid input syntax|invalid api key|jwt|not found|not exist|unauthorized|forbidden|expired|duplicate key|fetch failed|ECONNREFUSED|relation .* does not exist|column .* does not exist/i.test(
    message,
  );
}

function isRuntimeCrash(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return !isExpectedIntegrationError(error);
  }

  if (isExpectedIntegrationError(error)) {
    return false;
  }

  return (
    error instanceof TypeError ||
    error instanceof ReferenceError ||
    /Cannot read|is not a function|is not iterable|undefined/.test(
      error.message,
    )
  );
}

export function assertConnectedSupabaseEnv() {
  expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBeTruthy();
  expect(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBeTruthy();
}

export async function invokeAllExportedFunctions(
  moduleName: string,
  moduleExports: Record<string, unknown>,
) {
  const entries = Object.entries(moduleExports).filter(
    ([, exported]) => typeof exported === "function",
  ) as Array<[string, AnyFn]>;

  expect(entries.length).toBeGreaterThan(0);

  for (const [name, fn] of entries) {
    const args = buildArgs(name, fn.length);

    try {
      await Promise.resolve(fn(...args));
    } catch (error) {
      expect(
        isRuntimeCrash(error),
        `${moduleName}.${name} crashed with unexpected runtime error: ${String(error)}`,
      ).toBe(false);
    }
  }
}

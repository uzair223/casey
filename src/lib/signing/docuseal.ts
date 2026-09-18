import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";

type JsonRecord = Record<string, unknown>;

type DocusealSubmitter = {
  id?: number;
  submission_id?: number;
  slug?: string;
  embed_src?: string;
  email?: string;
  status?: string;
  metadata?: Record<string, string>;
};

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function getDocusealOrigin() {
  const raw = env.NEXT_PUBLIC_DOCUSEAL_URL || env.DOCUSEAL_URL;
  if (!raw) {
    return "";
  }
  try {
    return new URL(raw).origin;
  } catch {
    return trimTrailingSlash(raw);
  }
}

function getDocusealApiBase() {
  const raw = trimTrailingSlash(env.DOCUSEAL_URL || env.NEXT_PUBLIC_DOCUSEAL_URL);
  if (!raw) {
    throw new Error("Missing DOCUSEAL_URL");
  }
  return raw.endsWith("/api") ? raw : `${raw}/api`;
}

function getAuthHeaders(extra?: HeadersInit): Headers {
  const apiKey = env.DOCUSEAL_API_KEY;
  if (!apiKey) {
    throw new Error("Missing DOCUSEAL_API_KEY");
  }
  const headers = new Headers(extra);
  headers.set("X-Auth-Token", apiKey);
  return headers;
}

async function readJson(response: Response) {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function errorMessage(payload: unknown, fallback: string) {
  if (typeof payload === "string" && payload.trim()) {
    return payload;
  }
  if (payload && typeof payload === "object") {
    const record = payload as JsonRecord;
    if (typeof record.error === "string" && record.error.trim()) {
      return record.error;
    }
    if (typeof record.message === "string" && record.message.trim()) {
      return record.message;
    }
  }
  return fallback;
}

export function isDocusealConfigured() {
  return Boolean(
    (env.DOCUSEAL_URL || env.NEXT_PUBLIC_DOCUSEAL_URL) && env.DOCUSEAL_API_KEY,
  );
}

function asSubmitters(payload: unknown): DocusealSubmitter[] {
  if (Array.isArray(payload)) {
    return payload as DocusealSubmitter[];
  }
  if (payload && typeof payload === "object") {
    const record = payload as JsonRecord;
    if (Array.isArray(record.submitters)) {
      return record.submitters as DocusealSubmitter[];
    }
  }
  return [];
}

type CreateEmbeddedParams = {
  file: Uint8Array;
  fileName: string;
  signerName: string;
  signerEmail: string;
  statementId: string;
  tenantId: string;
  title: string;
  redirectUrl?: string;
};

export async function createEmbeddedSignatureRequest(
  params: CreateEmbeddedParams,
) {
  const response = await fetch(`${getDocusealApiBase()}/submissions/docx`, {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      name: params.title,
      send_email: false,
      ...(params.redirectUrl
        ? { completed_redirect_url: params.redirectUrl }
        : {}),
      documents: [
        {
          name: params.fileName,
          file: Buffer.from(params.file).toString("base64"),
        },
      ],
      submitters: [
        {
          role: "First Party",
          name: params.signerName,
          email: params.signerEmail,
          external_id: params.statementId,
          metadata: {
            statement_id: params.statementId,
            tenant_id: params.tenantId,
          },
        },
      ],
    }),
  });

  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(errorMessage(payload, "Failed to create DocuSeal submission"));
  }

  const submitter = asSubmitters(payload)[0];
  const origin = getDocusealOrigin();
  const embedSrc =
    submitter?.embed_src ||
    (submitter?.slug && origin ? `${origin}/s/${submitter.slug}` : null);

  if (!submitter?.submission_id || !submitter.id || !embedSrc) {
    throw new Error("DocuSeal did not return an embedded signing URL");
  }

  return {
    submissionId: String(submitter.submission_id),
    submitterId: String(submitter.id),
    submitterSlug: submitter.slug ?? null,
    embedSrc,
  };
}

export async function downloadSignedFile(submissionId: string) {
  const response = await fetch(
    `${getDocusealApiBase()}/submissions/${encodeURIComponent(submissionId)}/documents?merge=true`,
    {
      headers: getAuthHeaders(),
    },
  );
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(errorMessage(payload, "Failed to list DocuSeal documents"));
  }

  const documents =
    payload && typeof payload === "object" && Array.isArray((payload as JsonRecord).documents)
      ? ((payload as JsonRecord).documents as Array<{ url?: string; name?: string }>)
      : [];
  const fileUrl = documents[0]?.url;
  if (!fileUrl) {
    throw new Error("DocuSeal did not return a signed document");
  }

  const fileResponse = await fetch(fileUrl, {
    headers: getAuthHeaders(),
  });
  if (!fileResponse.ok) {
    throw new Error("Failed to download DocuSeal file");
  }

  return {
    bytes: new Uint8Array(await fileResponse.arrayBuffer()),
    contentType: fileResponse.headers.get("content-type") || "application/pdf",
    fileName: documents[0]?.name || "signed-statement.pdf",
  };
}

export function verifyDocusealWebhookSignature(params: {
  rawBody: string;
  signatureHeader: string | null;
}) {
  const secret = env.DOCUSEAL_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return env.NODE_ENV !== "production";
  }

  const header = params.signatureHeader?.trim() || "";
  const [timestamp, signature] = header.split(".", 2);
  if (!timestamp || !signature) {
    return false;
  }

  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > 300) {
    return false;
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${params.rawBody}`)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  return (
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

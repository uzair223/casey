import { NextRequest } from "next/server";
import { enforcePersistentRateLimit } from "@/lib/api-utils";
import { logServerEvent } from "@/lib/observability/logger";

const MAX_REPORT_SIZE_BYTES = 32_768;

type CspReportEnvelope = {
  "csp-report"?: Record<string, unknown>;
};

function normalizeCspPayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.slice(0, 10);
  }

  if (value && typeof value === "object") {
    const envelope = value as CspReportEnvelope;
    return envelope["csp-report"] ?? value;
  }

  return { raw: String(value ?? "") };
}

async function ingestReport(request: NextRequest) {
  const rateLimitResponse = await enforcePersistentRateLimit({
    request,
    scope: "security:csp-report",
    limit: 120,
    windowSeconds: 60,
  });

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_REPORT_SIZE_BYTES) {
    await logServerEvent("warn", "security.csp.report.rejected", {
      reason: "payload_too_large",
      contentLength,
    });

    return new Response(null, { status: 204 });
  }

  const contentType = request.headers.get("content-type") ?? "unknown";

  let parsedBody: unknown = null;
  try {
    parsedBody = await request.json();
  } catch {
    const rawText = await request.text().catch(() => "");
    parsedBody = { raw: rawText.slice(0, 4_000) };
  }

  await logServerEvent("warn", "security.csp.report.received", {
    contentType,
    report: normalizeCspPayload(parsedBody),
  });

  return new Response(null, { status: 204 });
}

export async function POST(request: NextRequest) {
  return ingestReport(request);
}

export async function PUT(request: NextRequest) {
  return ingestReport(request);
}

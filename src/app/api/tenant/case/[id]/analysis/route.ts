import { randomUUID } from "crypto";

import { NextResponse } from "next/server";

import { enqueueAiJob } from "@/lib/ai-workers/jobs";
import { requireTenantUser } from "@/lib/api-utils/auth";
import { forbidden, notFound } from "@/lib/api-utils/response";
import { logServerEvent } from "@/lib/observability/logger";
import { getServiceClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  const { id: caseId } = await context.params;

  try {
    const auth = await requireTenantUser(request);

    if (!["tenant_admin", "solicitor", "paralegal"].includes(auth.role)) {
      return forbidden();
    }

    const { data: caseRecord, error: caseError } = await auth.supabase
      .from("cases")
      .select("id, tenant_id")
      .eq("id", caseId)
      .maybeSingle();

    if (caseError) {
      throw caseError;
    }

    if (!caseRecord) {
      return notFound("Case not found");
    }

    if (caseRecord.tenant_id !== auth.tenantId) {
      return forbidden();
    }

    const service = getServiceClient("api.case_analysis.enqueue");
    const { data: job, error: jobError } = await service
      .from("ai_generation_jobs")
      .insert({
        tenant_id: auth.tenantId,
        kind: "case_analysis",
        target_id: caseId,
        status: "queued",
        requested_by_user_id: auth.userId,
        request_payload: { requestId },
      })
      .select("id, status, created_at")
      .single();

    if (jobError || !job) {
      throw jobError ?? new Error("Failed to enqueue case analysis job.");
    }

    try {
      await enqueueAiJob({
        jobId: job.id,
        kind: "case_analysis",
      });
    } catch (error) {
      await logServerEvent("error", "api.case_analysis.enqueue_failed", {
        requestId,
        caseId,
        jobId: job.id,
        error,
      });
    }

    return NextResponse.json(
      {
        id: job.id,
        status: job.status,
        created_at: job.created_at,
      },
      { status: 202 },
    );
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    await logServerEvent("error", "api.case_analysis.failed", {
      requestId,
      caseId,
      error,
    });

    return NextResponse.json(
      { error: "Unable to generate case analysis." },
      { status: 500 },
    );
  }
}

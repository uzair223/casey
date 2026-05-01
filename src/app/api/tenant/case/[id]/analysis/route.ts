import { randomUUID } from "crypto";

import { after, NextResponse } from "next/server";

import { requireTenantUser } from "@/lib/api-utils/auth";
import { forbidden, notFound } from "@/lib/api-utils/response";
import { getWorkerFailureMessage } from "@/lib/api-utils/worker-error";
import { processCaseAnalysisJob } from "@/lib/ai-workers/case-analysis";
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

    after(async () => {
      try {
        await processCaseAnalysisJob(job.id);
      } catch (error) {
        const responseBody =
          error instanceof Error
            ? JSON.stringify({ error: error.message })
            : JSON.stringify({ error: "Unknown worker error" });
        const workerErrorMessage = getWorkerFailureMessage({
          fallback: "Failed to start case analysis worker.",
          responseBody,
          status: 500,
        });
        console.error("Failed to invoke case analysis worker:", {
          status: 500,
          body: responseBody,
        });
        await logServerEvent(
          "error",
          "api.case_analysis.worker_invoke_failed",
          {
            requestId,
            caseId,
            jobId: job.id,
            status: 500,
            responseBody,
            workerErrorMessage,
          },
        );
        await service
          .from("ai_generation_jobs")
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
            error_message: workerErrorMessage,
          })
          .eq("id", job.id);
      }
    });

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

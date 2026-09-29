import "server-only";

import { randomUUID } from "node:crypto";

import { enqueueAiJob } from "@/lib/ai-workers/jobs";
import { logServerEvent } from "@/lib/observability/logger";
import { getServiceClient } from "@/lib/supabase/server";

export async function enqueueCaseAnalysis(params: {
  caseId: string;
  tenantId: string;
  requestId?: string;
  requestedByUserId?: string | null;
}) {
  const service = getServiceClient("enqueue-case-analysis");
  const { data: existing, error: existingError } = await service
    .from("ai_generation_jobs")
    .select("id, status, created_at")
    .eq("kind", "case_analysis")
    .eq("target_id", params.caseId)
    .eq("tenant_id", params.tenantId)
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return existing;

  const { data: job, error } = await service
    .from("ai_generation_jobs")
    .insert({
      tenant_id: params.tenantId,
      kind: "case_analysis",
      target_id: params.caseId,
      status: "queued",
      requested_by_user_id: params.requestedByUserId ?? null,
      request_payload: { requestId: params.requestId ?? randomUUID() },
    })
    .select("id, status, created_at")
    .single();
  if (error || !job) {
    throw error ?? new Error("Failed to enqueue case analysis job.");
  }

  try {
    await enqueueAiJob({ jobId: job.id, kind: "case_analysis" });
  } catch (enqueueError) {
    await logServerEvent("error", "api.case_analysis.enqueue_failed", {
      caseId: params.caseId,
      jobId: job.id,
      error: enqueueError,
    });
  }

  return job;
}

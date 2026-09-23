import "server-only";

import { randomUUID } from "node:crypto";

import { enqueueAiJob } from "@/lib/ai-workers/jobs";
import { getServiceClient } from "@/lib/supabase/server";

export async function enqueueStatementFormalization(params: {
  statementId: string;
  tenantId: string;
  requestId?: string;
}) {
  const service = getServiceClient("statement-formalize");
  const { data: statement, error } = await service
    .from("statements")
    .select("id, tenant_id, status")
    .eq("id", params.statementId)
    .eq("tenant_id", params.tenantId)
    .maybeSingle();
  if (error) throw error;
  if (!statement) return { error: "Statement not found", status: 404 as const };
  if (["locked", "demo_published", "finalized", "completed"].includes(statement.status)) {
    return { error: "This account can no longer be drafted.", status: 409 as const };
  }

  const { data: existingJob, error: existingJobError } = await service
    .from("ai_generation_jobs")
    .select("id, status, created_at")
    .eq("kind", "statement_formalization")
    .eq("target_id", statement.id)
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingJobError) throw existingJobError;

  let job = existingJob;
  if (!job) {
    const { data: createdJob, error: createJobError } = await service
      .from("ai_generation_jobs")
      .insert({
        tenant_id: statement.tenant_id,
        kind: "statement_formalization",
        target_id: statement.id,
        status: "queued",
        request_payload: { requestId: params.requestId ?? randomUUID(), source: "review" },
      })
      .select("id, status, created_at")
      .single();
    if (createJobError) throw createJobError;
    job = createdJob;
    await enqueueAiJob({ jobId: job.id, kind: "statement_formalization" });
  }

  return { job };
}

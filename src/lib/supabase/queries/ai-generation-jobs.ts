import { getSupabaseClient } from "../client";

export type AiGenerationJobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed";

export type AiGenerationJobView = {
  id: string;
  kind: "case_analysis";
  target_id: string;
  status: AiGenerationJobStatus;
  result_snapshot_id: string | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

const STALE_RUNNING_JOB_MS = 2 * 60 * 1000;

function markStaleRunningJob(job: AiGenerationJobView | null) {
  if (
    !job ||
    (job.status !== "queued" && job.status !== "running") ||
    !job.started_at
  ) {
    return job;
  }

  const startedAt = new Date(job.started_at).getTime();
  if (!Number.isFinite(startedAt)) {
    return job;
  }

  if (Date.now() - startedAt <= STALE_RUNNING_JOB_MS) {
    return job;
  }

  return {
    ...job,
    status: "failed" as const,
    error_message:
      job.error_message ||
      "Generation stalled before completion. Please try again.",
  };
}

export async function getLatestCaseAnalysisGenerationJob(
  caseId: string,
): Promise<AiGenerationJobView | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("ai_generation_jobs")
    .select(
      "id, kind, target_id, status, result_snapshot_id, error_message, created_at, started_at, completed_at",
    )
    .eq("kind", "case_analysis")
    .eq("target_id", caseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return markStaleRunningJob(data as AiGenerationJobView | null);
}

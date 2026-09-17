import "server-only";

import { env } from "@/lib/env";
import { getServiceClient } from "@/lib/supabase/server";

const STALE_AFTER_MS = 5 * 60 * 1000;

export function getMaxJobAttempts() {
  return env.FORMALIZE_MAX_ATTEMPTS || 3;
}

export async function claimGenerationJob(jobId: string) {
  const supabase = getServiceClient("claim-ai-job");
  const maxAttempts = getMaxJobAttempts();
  const now = new Date().toISOString();

  const { data: job, error } = await supabase
    .from("ai_generation_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (error || !job) {
    throw new Error("Job not found.");
  }

  if (job.status === "succeeded") {
    return { skipped: true as const, job };
  }

  const attemptCount =
    typeof job.attempt_count === "number" ? job.attempt_count : 0;
  const claimedAt = job.claimed_at ? Date.parse(job.claimed_at) : NaN;
  const isStaleRunning =
    job.status === "running" &&
    Number.isFinite(claimedAt) &&
    Date.now() - claimedAt > STALE_AFTER_MS;

  if (job.status === "running" && !isStaleRunning) {
    return { skipped: true as const, job };
  }

  if (attemptCount >= maxAttempts) {
    if (job.status !== "failed") {
      await supabase
        .from("ai_generation_jobs")
        .update({
          status: "failed",
          completed_at: now,
          error_message: job.error_message || "Max attempts exceeded",
        })
        .eq("id", jobId);
    }
    return { skipped: true as const, job };
  }

  const { data: claimed, error: claimError } = await supabase
    .from("ai_generation_jobs")
    .update({
      status: "running",
      claimed_at: now,
      started_at: job.started_at ?? now,
      attempt_count: attemptCount + 1,
      error_message: null,
    })
    .eq("id", jobId)
    .eq("attempt_count", attemptCount)
    .select("*")
    .maybeSingle();

  if (claimError) {
    throw claimError;
  }

  if (!claimed) {
    return { skipped: true as const, job };
  }

  return { skipped: false as const, job: claimed };
}

export async function completeGenerationJobFailure(params: {
  jobId: string;
  attemptCount: number;
  message: string;
}) {
  const supabase = getServiceClient("complete-ai-job-failure");
  const maxAttempts = getMaxJobAttempts();
  const exhausted = params.attemptCount >= maxAttempts;

  await supabase
    .from("ai_generation_jobs")
    .update({
      status: exhausted ? "failed" : "queued",
      completed_at: exhausted ? new Date().toISOString() : null,
      claimed_at: exhausted ? new Date().toISOString() : null,
      error_message: params.message,
    })
    .eq("id", params.jobId);
}

export async function listJobsForSweeper(limit: number) {
  const supabase = getServiceClient("list-ai-jobs");
  const staleBefore = new Date(Date.now() - STALE_AFTER_MS).toISOString();
  const maxAttempts = getMaxJobAttempts();

  const { data, error } = await supabase
    .from("ai_generation_jobs")
    .select("id, kind, status, claimed_at, attempt_count")
    .in("status", ["queued", "running"])
    .lt("attempt_count", maxAttempts)
    .order("created_at", { ascending: true })
    .limit(Math.max(1, Math.min(20, limit)));

  if (error) {
    throw error;
  }

  return (data ?? []).filter((job) => {
    if (job.status === "queued") return true;
    if (!job.claimed_at) return true;
    return job.claimed_at <= staleBefore;
  });
}

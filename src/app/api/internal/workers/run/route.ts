import { NextResponse } from "next/server";

import { isAiJobKind, processAiJob } from "@/lib/ai-workers/jobs";
import { listJobsForSweeper } from "@/lib/ai-workers/claim";
import { requireCronSecret } from "@/lib/api-utils/cron-auth";
import { logServerEvent } from "@/lib/observability/logger";

export async function POST(request: Request) {
  try {
    requireCronSecret(request);
    const body = await request.json().catch(() => ({}));
    const limit = Math.max(1, Math.min(20, Number(body?.limit ?? 5)));
    const jobs = await listJobsForSweeper(limit);
    const results: Array<{
      jobId: string;
      kind: string;
      ok: boolean;
      error?: string;
    }> = [];

    for (const job of jobs) {
      try {
        if (!isAiJobKind(job.kind)) {
          throw new Error(`Unsupported job kind: ${job.kind}`);
        }
        await processAiJob({ jobId: job.id, kind: job.kind });
        results.push({ jobId: job.id, kind: job.kind, ok: true });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        results.push({
          jobId: job.id,
          kind: job.kind,
          ok: false,
          error: message,
        });
        void logServerEvent("error", "api.internal.workers.run.job_failed", {
          jobId: job.id,
          kind: job.kind,
          error: message,
        });
      }
    }

    return NextResponse.json({
      processed: results.length,
      succeeded: results.filter((result) => result.ok).length,
      failed: results.filter((result) => !result.ok).length,
      results,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}

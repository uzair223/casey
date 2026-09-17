import { NextResponse } from "next/server";

import { requireCronSecret } from "@/lib/api-utils/cron-auth";
import { processCaseAnalysisJob } from "@/lib/ai-workers/case-analysis";

export async function POST(request: Request) {
  try {
    requireCronSecret(request);
    const { jobId } = await request.json().catch(() => ({ jobId: null }));
    if (!jobId || typeof jobId !== "string") {
      return NextResponse.json(
        { error: "jobId is required." },
        { status: 400 },
      );
    }

    const result = await processCaseAnalysisJob(jobId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";

import { processCaseAnalysisJob } from "@/lib/ai-workers/case-analysis";

export async function POST(request: Request) {
  try {
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
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

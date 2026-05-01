import { randomUUID } from "crypto";

import { after, NextResponse } from "next/server";

import { getIntakeAccessError } from "@/lib/api-utils/intake-access";
import { getWorkerFailureMessage } from "@/lib/api-utils/worker-error";
import { processFormalizationJob } from "@/lib/ai-workers/statement-formalization";
import { logServerEvent } from "@/lib/observability/logger";
import { getServiceClient } from "@/lib/supabase/server";
import { SERVERONLY_getStatementWithConfigFromToken } from "@/lib/supabase/queries";

type RouteContext = {
  params: Promise<{ token: string }>;
};

function isFormalizeBlocked(status: string) {
  return ["locked", "demo_published", "finalized", "completed"].includes(
    status,
  );
}

async function getLatestFormalizationJob(statementId: string) {
  const service = getServiceClient("api.intake.formalize.latest_job");
  const { data, error } = await service
    .from("ai_generation_jobs")
    .select(
      "id, status, error_message, formalization_snapshot_id, created_at, started_at, completed_at",
    )
    .eq("kind", "statement_formalization")
    .eq("target_id", statementId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function getFormalizedSections(snapshotId: string | null | undefined) {
  if (!snapshotId) {
    return {};
  }

  const service = getServiceClient("api.intake.formalize.snapshot");
  const { data, error } = await service
    .from("statement_formalization_snapshots")
    .select("sections")
    .eq("id", snapshotId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (
    !data?.sections ||
    typeof data.sections !== "object" ||
    Array.isArray(data.sections)
  ) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(data.sections as Record<string, unknown>).map(
      ([key, value]) => [
        key,
        typeof value === "string" ? value : value == null ? "" : String(value),
      ],
    ),
  );
}

export async function GET(request: Request, { params }: RouteContext) {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();

  try {
    const { token } = await params;
    const statement = await SERVERONLY_getStatementWithConfigFromToken(token);

    if (!statement) {
      return NextResponse.json(
        { error: "Link not available" },
        { status: 404 },
      );
    }

    const accessError = await getIntakeAccessError(
      request,
      statement.status,
      "interact",
    );
    if (accessError) {
      return accessError;
    }

    const latestJob = await getLatestFormalizationJob(statement.id);
    const snapshotId =
      latestJob?.formalization_snapshot_id ??
      statement.formalization_snapshot_id;
    const sections =
      latestJob?.status === "succeeded"
        ? await getFormalizedSections(snapshotId)
        : statement.sections;

    return NextResponse.json({
      job: latestJob,
      sections: sections ?? {},
    });
  } catch (error) {
    await logServerEvent("error", "api.intake.formalize.poll_failed", {
      requestId,
      error,
    });
    return NextResponse.json(
      { error: "Failed to get formalization status" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();

  try {
    const { token } = await params;
    const statement = await SERVERONLY_getStatementWithConfigFromToken(token);

    if (!statement) {
      await logServerEvent("warn", "api.intake.formalize.not_found", {
        requestId,
        tokenSuffix: token.slice(-6),
      });
      return NextResponse.json(
        { error: "Link not available" },
        { status: 404 },
      );
    }

    const accessError = await getIntakeAccessError(
      request,
      statement.status,
      "interact",
    );
    if (accessError) {
      await logServerEvent("warn", "api.intake.formalize.access_denied", {
        requestId,
        status: accessError.status,
      });
      return accessError;
    }

    if (isFormalizeBlocked(statement.status)) {
      await logServerEvent("warn", "api.intake.formalize.precondition_failed", {
        requestId,
        reason: "statement_not_formalizable",
        statementId: statement.id,
      });
      return NextResponse.json(
        { error: "Unauthorized or locked." },
        { status: 409 },
      );
    }

    const service = getServiceClient("api.intake.formalize.enqueue");
    const { data: existingJob, error: existingJobError } = await service
      .from("ai_generation_jobs")
      .select("id, status, created_at")
      .eq("kind", "statement_formalization")
      .eq("target_id", statement.id)
      .in("status", ["queued", "running"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingJobError) {
      throw existingJobError;
    }

    let job = existingJob;

    if (!job) {
      const { data: createdJob, error: createJobError } = await service
        .from("ai_generation_jobs")
        .insert({
          tenant_id: statement.tenant_id,
          kind: "statement_formalization",
          target_id: statement.id,
          status: "queued",
          request_payload: { requestId, tokenSuffix: token.slice(-6) },
        })
        .select("id, status, created_at")
        .single();

      if (createJobError) {
        throw createJobError;
      }

      job = createdJob;
    }

    if (!job) {
      throw new Error("Failed to enqueue statement formalization job.");
    }

    if (!existingJob) {
      after(async () => {
        try {
          await processFormalizationJob(job.id);
        } catch (error) {
          const responseBody =
            error instanceof Error
              ? JSON.stringify({ error: error.message })
              : JSON.stringify({ error: "Unknown worker error" });
          const workerErrorMessage = getWorkerFailureMessage({
            fallback: "Failed to start statement formalization worker.",
            responseBody,
            status: 500,
          });
          await logServerEvent(
            "error",
            "api.intake.formalize.worker_invoke_failed",
            {
              requestId,
              statementId: statement.id,
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
    }

    await logServerEvent("info", "api.intake.formalize.queued", {
      requestId,
      statementId: statement.id,
      jobId: job.id,
      reused: !!existingJob,
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
    await logServerEvent("error", "api.intake.formalize.failed", {
      requestId,
      error,
    });
    return NextResponse.json(
      { error: "Failed to formalize statement" },
      { status: 500 },
    );
  }
}

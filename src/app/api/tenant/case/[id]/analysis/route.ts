import { randomUUID } from "crypto";

import { NextResponse } from "next/server";

import { paidAiDenial } from "@/lib/billing/paid-plan";
import { requireTenantUser } from "@/lib/api-utils/auth";
import { forbidden, notFound } from "@/lib/api-utils/response";
import { enqueueCaseAnalysis } from "@/lib/leads/analyse";
import { logServerEvent } from "@/lib/observability/logger";

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

    const denied = await paidAiDenial({
      role: auth.role,
      tenantId: auth.tenantId,
    });
    if (denied) return denied;

    const job = await enqueueCaseAnalysis({
      caseId,
      tenantId: auth.tenantId,
      requestId,
      requestedByUserId: auth.userId,
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

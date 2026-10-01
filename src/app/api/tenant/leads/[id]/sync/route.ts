import { NextResponse } from "next/server";

import { conflict, ok, requireTenantManager, serverError } from "@/lib/api-utils";
import { ProviderError } from "@/lib/leads/acquisition/http";
import { pushAcceptedLead, summarisePushes } from "@/lib/leads/acquisition/push";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const auth = await requireTenantManager(request);
    const { id } = await params;
    const results = await pushAcceptedLead({ tenantId: auth.tenantId, statementId: id });
    const summary = summarisePushes(results);
    if (summary.status === "skipped") {
      return conflict("Connect Clio or a webhook in public intake settings.");
    }
    if (summary.status === "failed") {
      return NextResponse.json(
        { error: summary.error || "The handoff did not send.", results },
        { status: 502 },
      );
    }
    return ok({ status: summary.status, results });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof ProviderError) return conflict(error.message);
    return serverError(error);
  }
}

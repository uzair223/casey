import { NextResponse } from "next/server";

import { badRequest, ok, serverError } from "@/lib/api-utils";
import {
  enforcePublicIpLimit,
  enforcePublicTurnBudget,
} from "@/lib/leads/abuse";
import { getServiceClient } from "@/lib/supabase/server";
import { takeQualificationTurn } from "@/lib/leads/sessions";

type RouteContext = { params: Promise<{ token: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const ipLimit = await enforcePublicIpLimit(request, "public-qualify-message");
    if (ipLimit) return ipLimit;

    const { token } = await params;
    const body = (await request.json().catch(() => null)) as {
      message?: string;
    } | null;
    if (!body?.message?.trim()) return badRequest("Write a message first.");

    const supabase = getServiceClient("public-qualify-message");
    const { data: session } = await supabase
      .from("lead_sessions")
      .select("tenant_id, tenants(plan)")
      .eq("token", token)
      .maybeSingle();
    const tenant = Array.isArray(session?.tenants)
      ? session?.tenants[0]
      : session?.tenants;
    if (session?.tenant_id) {
      const budget = await enforcePublicTurnBudget({
        request,
        tenantId: session.tenant_id,
        plan: tenant?.plan,
      });
      if (budget) {
        return NextResponse.json(
          {
            error: "Leave your details and the firm will be in touch.",
            fallback: true,
          },
          { status: 429 },
        );
      }
    }

    const result = await takeQualificationTurn({
      token,
      message: body.message,
    });
    if ("error" in result && result.error && "status" in result && !("reply" in result)) {
      return NextResponse.json(
        { error: result.error, fallback: "fallback" in result ? result.fallback : false },
        { status: result.status },
      );
    }
    return ok(result);
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError(error);
  }
}

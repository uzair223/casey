import { NextResponse } from "next/server";

import { serverError } from "@/lib/api-utils";
import { enforcePublicIpLimit } from "@/lib/leads/abuse";
import { loadPublicEnquirySession } from "@/lib/leads/sessions";

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const ipLimit = await enforcePublicIpLimit(request, "public-qualify-resume");
    if (ipLimit) return ipLimit;

    const { token } = await params;
    const result = await loadPublicEnquirySession(token);
    if ("token" in result) return NextResponse.json(result);
    return NextResponse.json({ error: result.error }, { status: result.status });
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError(error);
  }
}

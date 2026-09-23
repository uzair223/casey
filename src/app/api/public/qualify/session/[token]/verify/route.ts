import { NextResponse } from "next/server";

import { badRequest, ok, serverError } from "@/lib/api-utils";
import { confirmQualificationCode } from "@/lib/leads/sessions";

type RouteContext = { params: Promise<{ token: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { token } = await params;
    const body = (await request.json().catch(() => null)) as { code?: string } | null;
    if (!body?.code?.trim()) return badRequest("Enter the code.");
    const result = await confirmQualificationCode({ token, code: body.code });
    if ("error" in result && result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return ok(result);
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError(error);
  }
}

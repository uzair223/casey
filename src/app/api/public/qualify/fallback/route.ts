import { NextResponse } from "next/server";

import { badRequest, ok, serverError } from "@/lib/api-utils";
import { clientIp, verifyTurnstile } from "@/lib/leads/abuse";
import { getChannelByKey } from "@/lib/leads/channels";
import { storeFallbackEnquiry } from "@/lib/leads/sessions";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      publicKey?: string;
      turnstileToken?: string;
      name?: string;
      email?: string;
      phone?: string;
      summary?: string;
    } | null;
    if (!body?.publicKey || !body.name?.trim()) {
      return badRequest("Name is required");
    }
    const human = await verifyTurnstile(
      body.turnstileToken ?? null,
      clientIp(request),
    );
    if (!human) {
      return NextResponse.json({ error: "Confirm you are a person." }, { status: 400 });
    }
    const channel = await getChannelByKey(body.publicKey);
    if (!channel) {
      return NextResponse.json({ error: "This enquiry page is off." }, { status: 404 });
    }
    const saved = await storeFallbackEnquiry({
      tenantId: channel.tenantId,
      leadTypeId: channel.leadTypeId,
      leadTypeName: channel.leadTypeName,
      name: body.name.trim(),
      email: body.email?.trim() ?? "",
      phone: body.phone?.trim() ?? "",
      summary: body.summary?.trim() ?? "",
      plan: channel.plan,
      config: channel.config,
    });
    return ok({ id: saved.statementId });
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError(error);
  }
}

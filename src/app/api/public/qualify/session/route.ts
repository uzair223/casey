import { NextResponse } from "next/server";

import { badRequest, ok, serverError } from "@/lib/api-utils";
import {
  clientIp,
  enforcePublicIpLimit,
  verifyTurnstile,
} from "@/lib/leads/abuse";
import { getChannelByKey } from "@/lib/leads/channels";
import { createQualificationSession } from "@/lib/leads/sessions";

export async function POST(request: Request) {
  try {
    const ipLimit = await enforcePublicIpLimit(request, "public-qualify-session");
    if (ipLimit) return ipLimit;

    const body = (await request.json().catch(() => null)) as {
      publicKey?: string;
      turnstileToken?: string;
    } | null;
    if (!body?.publicKey) return badRequest("Missing lead channel");

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

    const session = await createQualificationSession({
      channelId: channel.channelId,
      tenantId: channel.tenantId,
      leadTypeId: channel.leadTypeId,
      slots: channel.config.qualification_slots,
    });
    return ok(session);
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError(error);
  }
}

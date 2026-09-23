import { NextResponse } from "next/server";

import { getChannelByKey } from "@/lib/leads/channels";

type RouteContext = { params: Promise<{ key: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { key } = await params;
  const channel = await getChannelByKey(key);
  if (!channel) {
    return NextResponse.json({ error: "Widget unavailable" }, { status: 404 });
  }
  if (!channel.widget) {
    return NextResponse.json(
      { error: "The website widget is part of Growth.", gate: "growth" },
      { status: 403 },
    );
  }
  return NextResponse.json({
    firmName: channel.tenantName,
    leadTypeName: channel.leadTypeName,
    welcome: channel.welcome,
    branding: channel.branding,
    publicKey: channel.publicKey,
  });
}

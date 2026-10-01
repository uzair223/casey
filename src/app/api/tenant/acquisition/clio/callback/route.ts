import { NextResponse } from "next/server";

import { clioRegion, exchangeClioCode } from "@/lib/leads/acquisition/clio";
import { ProviderError } from "@/lib/leads/acquisition/http";
import { intakeRedirect, readOAuthState } from "@/lib/leads/acquisition/oauth";
import { saveCrmConnection } from "@/lib/leads/acquisition/store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const failed = (message: string) => NextResponse.redirect(intakeRedirect({ error: message }));
  try {
    const state = readOAuthState(url.searchParams.get("state"), "clio");
    if (!state) return failed("The connection expired. Try again.");
    const code = url.searchParams.get("code");
    if (!code) return failed(url.searchParams.get("error_description") || "Clio was not connected.");
    const region = clioRegion(state.region);
    const token = await exchangeClioCode(code, region);
    if (!token.access_token) return failed("Clio was not connected.");
    await saveCrmConnection({
      tenantId: state.tenantId,
      provider: "clio",
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? null,
      expiresAt: token.expires_in
        ? new Date(Date.now() + token.expires_in * 1000).toISOString()
        : null,
      region,
    });
    return NextResponse.redirect(intakeRedirect({ connected: "clio" }));
  } catch (error) {
    if (error instanceof ProviderError) return failed(error.message);
    return failed("Clio was not connected.");
  }
}

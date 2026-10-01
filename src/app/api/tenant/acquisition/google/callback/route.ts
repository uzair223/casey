import { NextResponse } from "next/server";

import { widgetEnabled } from "@/lib/billing/plans";
import { chooseGoogleCustomer, exchangeGoogleCode } from "@/lib/leads/acquisition/google";
import { ProviderError } from "@/lib/leads/acquisition/http";
import { intakeRedirect, readOAuthState } from "@/lib/leads/acquisition/oauth";
import { saveAdAccount } from "@/lib/leads/acquisition/store";
import { getServiceClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const failed = (message: string) => NextResponse.redirect(intakeRedirect({ error: message }, "/dashboard/marketing/creative"));
  try {
    const state = readOAuthState(url.searchParams.get("state"), "google");
    if (!state) return failed("The connection expired. Try again.");
    const code = url.searchParams.get("code");
    if (!code) {
      return failed(url.searchParams.get("error_description") || "Google Ads was not connected.");
    }
    const supabase = getServiceClient("google-ads-callback");
    const { data, error } = await supabase
      .from("tenants")
      .select("plan")
      .eq("id", state.tenantId)
      .maybeSingle();
    if (error) throw error;
    if (!widgetEnabled(data?.plan)) return failed("Connecting Google Ads is part of Growth.");
    const token = await exchangeGoogleCode(code);
    if (!token.access_token) return failed("Google Ads was not connected.");
    const customer = await chooseGoogleCustomer(token.access_token);
    await saveAdAccount({
      tenantId: state.tenantId,
      provider: "google",
      externalAccountId: customer.id,
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? null,
      expiresAt: token.expires_in
        ? new Date(Date.now() + token.expires_in * 1000).toISOString()
        : null,
      details: {
        loginCustomerId: customer.loginCustomerId,
        currency: customer.currency,
      },
    });
    return NextResponse.redirect(intakeRedirect({ connected: "google" }, "/dashboard/marketing/creative"));
  } catch (error) {
    if (error instanceof ProviderError) return failed(error.message);
    return failed("Google Ads was not connected.");
  }
}

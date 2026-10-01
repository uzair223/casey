import { NextResponse } from "next/server";

import { widgetEnabled } from "@/lib/billing/plans";
import { ProviderError } from "@/lib/leads/acquisition/http";
import { chooseMetaAccount, exchangeMetaCode } from "@/lib/leads/acquisition/meta";
import { intakeRedirect, readOAuthState } from "@/lib/leads/acquisition/oauth";
import { saveAdAccount } from "@/lib/leads/acquisition/store";
import { getServiceClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const failed = (message: string) => NextResponse.redirect(intakeRedirect({ error: message }, "/dashboard/marketing/creative"));
  try {
    const state = readOAuthState(url.searchParams.get("state"), "meta");
    if (!state) return failed("The connection expired. Try again.");
    const code = url.searchParams.get("code");
    if (!code) return failed(url.searchParams.get("error_description") || "Meta was not connected.");
    const supabase = getServiceClient("meta-ads-callback");
    const { data, error } = await supabase
      .from("tenants")
      .select("plan")
      .eq("id", state.tenantId)
      .maybeSingle();
    if (error) throw error;
    if (!widgetEnabled(data?.plan)) return failed("Connecting Meta is part of Growth.");
    const token = await exchangeMetaCode(code);
    const account = await chooseMetaAccount(token.access_token);
    await saveAdAccount({
      tenantId: state.tenantId,
      provider: "meta",
      externalAccountId: account.adAccountId,
      accessToken: token.access_token,
      refreshToken: null,
      expiresAt: token.expires_in
        ? new Date(Date.now() + token.expires_in * 1000).toISOString()
        : null,
      details: {
        pageId: account.pageId,
        pageName: account.pageName,
        currency: account.currency,
      },
    });
    return NextResponse.redirect(intakeRedirect({ connected: "meta" }, "/dashboard/marketing/creative"));
  } catch (error) {
    if (error instanceof ProviderError) return failed(error.message);
    return failed("Meta was not connected.");
  }
}

import "server-only";

import { env } from "@/lib/env";
import { googleSearchMutations, type FirmAd } from "./creative";
import { postForm, providerJson, ProviderError } from "./http";
import { oauthRedirect } from "./oauth";
import { asRecord, textField, updateAdAccount, type AdAccountRow } from "./store";

const ADS = "https://googleads.googleapis.com/v25";
const TOKEN = "https://oauth2.googleapis.com/token";

export function googleConfigured() {
  return Boolean(
    env.GOOGLE_ADS_CLIENT_ID &&
      env.GOOGLE_ADS_CLIENT_SECRET &&
      env.GOOGLE_ADS_DEVELOPER_TOKEN,
  );
}

export function googleStartUrl(state: string) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", env.GOOGLE_ADS_CLIENT_ID);
  url.searchParams.set("redirect_uri", oauthRedirect("google"));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "https://www.googleapis.com/auth/adwords");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url;
}

export async function exchangeGoogleCode(code: string) {
  const token = await postForm(TOKEN, {
    code,
    client_id: env.GOOGLE_ADS_CLIENT_ID,
    client_secret: env.GOOGLE_ADS_CLIENT_SECRET,
    redirect_uri: oauthRedirect("google"),
    grant_type: "authorization_code",
  });
  if (!token.access_token) throw new ProviderError("Google did not return an access token.");
  return token;
}

async function refreshGoogle(account: AdAccountRow) {
  if (!account.refresh_token) throw new ProviderError("Reconnect Google Ads.");
  if (account.expires_at && new Date(account.expires_at).getTime() > Date.now() + 60_000) {
    return account.access_token ?? "";
  }
  const token = await postForm(TOKEN, {
    client_id: env.GOOGLE_ADS_CLIENT_ID,
    client_secret: env.GOOGLE_ADS_CLIENT_SECRET,
    refresh_token: account.refresh_token,
    grant_type: "refresh_token",
  });
  if (!token.access_token) throw new ProviderError("Google Ads needs to be connected again.");
  const expiresAt = token.expires_in
    ? new Date(Date.now() + token.expires_in * 1000).toISOString()
    : null;
  await updateAdAccount(account.id, { access_token: token.access_token, expires_at: expiresAt });
  account.access_token = token.access_token;
  account.expires_at = expiresAt;
  return token.access_token;
}

function adsHeaders(accessToken: string, loginCustomerId?: string | null) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": env.GOOGLE_ADS_DEVELOPER_TOKEN,
    "Content-Type": "application/json",
  };
  if (loginCustomerId) headers["login-customer-id"] = loginCustomerId;
  return headers;
}

function customerId(value: string) {
  return value.replace(/\D/g, "");
}

async function search(account: AdAccountRow, id: string, query: string, loginCustomerId?: string | null) {
  const accessToken = await refreshGoogle(account);
  const response = await fetch(`${ADS}/customers/${id}/googleAds:search`, {
    method: "POST",
    headers: adsHeaders(accessToken, loginCustomerId),
    body: JSON.stringify({ query }),
  });
  return providerJson<{ results?: Array<Record<string, unknown>> }>(response);
}

type GoogleCustomer = {
  id: string;
  manager: boolean;
  currency: string;
  loginCustomerId: string | null;
};

export async function chooseGoogleCustomer(accessToken: string) {
  const listed = await providerJson<{ resourceNames?: string[] }>(
    await fetch(`${ADS}/customers:listAccessibleCustomers`, {
      headers: adsHeaders(accessToken),
    }),
  );
  const ids = (listed.resourceNames ?? [])
    .map((name) => customerId(name))
    .filter(Boolean);
  const probe = {
    id: "probe",
    access_token: accessToken,
    refresh_token: null,
    expires_at: new Date(Date.now() + 3_600_000).toISOString(),
  } as AdAccountRow;

  for (const id of ids) {
    try {
      const own = await search(
        probe,
        id,
        "SELECT customer.id, customer.manager, customer.currency_code FROM customer LIMIT 1",
      );
      const customer = asRecord(own.results?.[0]?.customer);
      const currency = textField(customer.currencyCode) ?? textField(customer.currency_code);
      const manager = customer.manager === true;
      if (!manager && currency === "GBP") {
        return { id, manager: false, currency, loginCustomerId: null } satisfies GoogleCustomer;
      }
      if (!manager) continue;
      const clients = await search(
        probe,
        id,
        "SELECT customer_client.client_customer, customer_client.manager, customer_client.currency_code FROM customer_client WHERE customer_client.level <= 1",
        id,
      );
      for (const row of clients.results ?? []) {
        const client = asRecord(row.customerClient ?? row.customer_client);
        const clientCurrency = textField(client.currencyCode) ?? textField(client.currency_code);
        const clientManager = client.manager === true;
        const clientName = textField(client.clientCustomer) ?? textField(client.client_customer) ?? "";
        const clientId = customerId(clientName);
        if (clientId && !clientManager && clientCurrency === "GBP") {
          return { id: clientId, manager: false, currency: "GBP", loginCustomerId: id };
        }
      }
    } catch {
      continue;
    }
  }
  throw new ProviderError(
    "Connect a Google Ads account that bills in pounds. Casey sets the budget in pounds.",
  );
}

export async function resolveGooglePlaces(account: AdAccountRow, places: string[]) {
  if (!places.length) return { ids: ["2826"], missed: [] as string[] };
  const accessToken = await refreshGoogle(account);
  const ids: string[] = [];
  const missed: string[] = [];
  for (const place of places) {
    try {
      const response = await fetch(`${ADS}/geoTargetConstants:suggest`, {
        method: "POST",
        headers: adsHeaders(accessToken),
        body: JSON.stringify({
          locale: "en",
          countryCode: "GB",
          locationNames: { names: [place] },
        }),
      });
      const suggested = await providerJson<{
        geoTargetConstantSuggestions?: Array<{
          geoTargetConstant?: { id?: string; countryCode?: string; status?: string };
        }>;
      }>(response);
      const match = suggested.geoTargetConstantSuggestions?.find((row) => {
        const constant = row.geoTargetConstant;
        return constant?.id && constant.countryCode === "GB" && constant.status !== "REMOVAL_PLANNED";
      })?.geoTargetConstant?.id;
      if (match) ids.push(String(match).replace(/\D/g, ""));
      else missed.push(place);
    } catch {
      missed.push(place);
    }
  }
  return { ids: ids.length ? ids : ["2826"], missed };
}

export async function createGoogleSearchCampaign(params: {
  account: AdAccountRow;
  baseUrl: string;
  dailyMicros: string;
  ads: FirmAd[];
  geoIds: string[];
  imagePng?: Buffer;
}) {
  const details = asRecord(params.account.details);
  const id = customerId(params.account.external_account_id ?? "");
  if (!id) throw new ProviderError("Reconnect Google Ads.");
  const login = textField(details.loginCustomerId);
  const accessToken = await refreshGoogle(params.account);
  const stamp = Date.now();
  const response = await fetch(`${ADS}/customers/${id}/googleAds:mutate`, {
    method: "POST",
    headers: adsHeaders(accessToken, login),
    body: JSON.stringify({
      mutateOperations: googleSearchMutations({
        customerId: id,
        dailyMicros: params.dailyMicros,
        baseUrl: params.baseUrl,
        ads: params.ads,
        geoIds: params.geoIds,
        stamp,
      }),
    }),
  });
  const created = await providerJson<{
    mutateOperationResponses?: Array<{
      campaignResult?: { resourceName?: string };
      campaignBudgetResult?: { resourceName?: string };
    }>;
  }>(response);
  const campaignName = created.mutateOperationResponses?.find(
    (row) => row.campaignResult?.resourceName,
  )?.campaignResult?.resourceName;
  const budgetName = created.mutateOperationResponses?.find(
    (row) => row.campaignBudgetResult?.resourceName,
  )?.campaignBudgetResult?.resourceName;
  const campaignId = campaignName?.split("/").pop() ?? null;
  if (!campaignId) throw new ProviderError("Google Ads did not return the campaign.");
  if (params.imagePng) {
    await attachGoogleImage(params.account, campaignId, params.imagePng).catch(() => undefined);
  }
  return { campaignId, budgetResourceName: budgetName ?? null };
}

async function attachGoogleImage(account: AdAccountRow, campaignId: string, png: Buffer) {
  const id = customerId(account.external_account_id ?? "");
  const login = textField(asRecord(account.details).loginCustomerId);
  const accessToken = await refreshGoogle(account);
  const uploaded = await providerJson<{
    results?: Array<{ resourceName?: string }>;
  }>(
    await fetch(`${ADS}/customers/${id}/assets:mutate`, {
      method: "POST",
      headers: adsHeaders(accessToken, login),
      body: JSON.stringify({
        operations: [
          {
            create: {
              name: `Casey brand ${Date.now()}`,
              imageAsset: { data: png.toString("base64") },
            },
          },
        ],
      }),
    }),
  );
  const asset = uploaded.results?.[0]?.resourceName;
  if (!asset) return;
  await providerJson(
    await fetch(`${ADS}/customers/${id}/campaignAssets:mutate`, {
      method: "POST",
      headers: adsHeaders(accessToken, login),
      body: JSON.stringify({
        operations: [
          {
            create: {
              campaign: `customers/${id}/campaigns/${campaignId}`,
              asset,
              fieldType: "AD_IMAGE",
            },
          },
        ],
      }),
    }),
  );
}

export async function setGoogleBudget(
  account: AdAccountRow,
  budgetResourceName: string,
  dailyMicros: string,
) {
  const id = customerId(account.external_account_id ?? "");
  const login = textField(asRecord(account.details).loginCustomerId);
  const accessToken = await refreshGoogle(account);
  const response = await fetch(`${ADS}/customers/${id}/campaignBudgets:mutate`, {
    method: "POST",
    headers: adsHeaders(accessToken, login),
    body: JSON.stringify({
      operations: [
        {
          update: { resourceName: budgetResourceName, amountMicros: dailyMicros },
          updateMask: "amountMicros",
        },
      ],
    }),
  });
  await providerJson(response);
}

export async function setGoogleCampaignStatus(
  account: AdAccountRow,
  campaignId: string,
  status: "ENABLED" | "PAUSED",
) {
  const id = customerId(account.external_account_id ?? "");
  const login = textField(asRecord(account.details).loginCustomerId);
  const accessToken = await refreshGoogle(account);
  const response = await fetch(`${ADS}/customers/${id}/campaigns:mutate`, {
    method: "POST",
    headers: adsHeaders(accessToken, login),
    body: JSON.stringify({
      operations: [
        {
          update: { resourceName: `customers/${id}/campaigns/${campaignId}`, status },
          updateMask: "status",
        },
      ],
    }),
  });
  await providerJson(response);
}

export async function refreshGoogleSpend(account: AdAccountRow) {
  const id = customerId(account.external_account_id ?? "");
  const login = textField(asRecord(account.details).loginCustomerId);
  const spend: Record<string, { minor: number; currency: string }> = {};
  for (let daysAgo = 0; daysAgo < 3; daysAgo += 1) {
    const day = new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);
    const result = await search(
      account,
      id,
      `SELECT click_view.gclid, metrics.cost_micros FROM click_view WHERE segments.date = '${day}' LIMIT 5000`,
      login,
    );
    for (const row of result.results ?? []) {
      const click = asRecord(row.clickView ?? row.click_view);
      const metrics = asRecord(row.metrics);
      const gclid = textField(click.gclid);
      const micros = Number(metrics.costMicros ?? metrics.cost_micros ?? 0);
      if (!gclid || !Number.isFinite(micros) || micros <= 0) continue;
      const minor = Math.round(micros / 10_000);
      const current = spend[`gclid:${gclid}`];
      spend[`gclid:${gclid}`] = {
        minor: (current?.minor ?? 0) + minor,
        currency: "GBP",
      };
    }
  }
  return spend;
}

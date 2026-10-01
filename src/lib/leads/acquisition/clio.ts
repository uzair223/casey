import "server-only";

import { env } from "@/lib/env";
import { postForm, providerJson, ProviderError } from "./http";
import { oauthRedirect } from "./oauth";
import type { LeadHandoff } from "./push-result";
import { updateCrmTokens, type CrmConnectionRow } from "./store";

const REGIONS = {
  eu: { auth: "https://eu.auth.api.clio.com", api: "https://eu.app.clio.com/api/v4" },
  us: { auth: "https://auth.api.clio.com", api: "https://app.clio.com/api/v4" },
  ca: { auth: "https://ca.auth.api.clio.com", api: "https://ca.app.clio.com/api/v4" },
  au: { auth: "https://au.auth.api.clio.com", api: "https://au.app.clio.com/api/v4" },
} as const;

export type ClioRegion = keyof typeof REGIONS;

export function clioConfigured() {
  return Boolean(env.CLIO_CLIENT_ID && env.CLIO_CLIENT_SECRET);
}

export function clioRegion(value: string | null | undefined): ClioRegion {
  if (value && value in REGIONS) return value as ClioRegion;
  return "eu";
}

export function clioStartUrl(state: string, region: ClioRegion) {
  const url = new URL(`${REGIONS[region].auth}/oauth/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", env.CLIO_CLIENT_ID);
  url.searchParams.set("redirect_uri", oauthRedirect("clio"));
  url.searchParams.set(
    "scope",
    "contacts.read contacts.write matters.read matters.write",
  );
  url.searchParams.set("state", state);
  return url;
}

export async function exchangeClioCode(code: string, region: ClioRegion) {
  const token = await postForm(`${REGIONS[region].auth}/oauth/token`, {
    grant_type: "authorization_code",
    code,
    client_id: env.CLIO_CLIENT_ID,
    client_secret: env.CLIO_CLIENT_SECRET,
    redirect_uri: oauthRedirect("clio"),
  });
  if (!token.access_token) throw new ProviderError("Clio did not return an access token.");
  return token;
}

async function clioAccess(connection: CrmConnectionRow) {
  const region = clioRegion(connection.region);
  if (
    connection.access_token &&
    (!connection.expires_at || new Date(connection.expires_at).getTime() > Date.now() + 60_000)
  ) {
    return connection.access_token;
  }
  if (!connection.refresh_token) throw new ProviderError("Reconnect Clio.");
  const token = await postForm(`${REGIONS[region].auth}/oauth/token`, {
    grant_type: "refresh_token",
    refresh_token: connection.refresh_token,
    client_id: env.CLIO_CLIENT_ID,
    client_secret: env.CLIO_CLIENT_SECRET,
  });
  if (!token.access_token) throw new ProviderError("Clio needs to be connected again.");
  const expiresAt = token.expires_in
    ? new Date(Date.now() + token.expires_in * 1000).toISOString()
    : null;
  await updateCrmTokens(connection.id, {
    access_token: token.access_token,
    refresh_token: token.refresh_token ?? connection.refresh_token,
    expires_at: expiresAt,
  });
  return token.access_token;
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "Lead", last: "-" };
  if (parts.length === 1) return { first: parts[0], last: "-" };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

export async function pushLeadToClio(connection: CrmConnectionRow, handoff: LeadHandoff) {
  const token = await clioAccess(connection);
  const region = clioRegion(connection.region);
  const name = splitName(handoff.contact.name);
  const contactBody: Record<string, unknown> = {
    data: {
      type: "Person",
      first_name: name.first,
      last_name: name.last,
      ...(handoff.contact.email
        ? {
            email_addresses: [
              { address: handoff.contact.email, name: "Work", default_email: true },
            ],
          }
        : {}),
      ...(handoff.contact.phone
        ? {
            phone_numbers: [
              { number: handoff.contact.phone, name: "Work", default_number: true },
            ],
          }
        : {}),
    },
  };
  const contact = await providerJson<{ data?: { id?: number } }>(
    await fetch(`${REGIONS[region].api}/contacts.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(contactBody),
    }),
  );
  if (!contact.data?.id) throw new ProviderError("Clio did not return the contact.");
  const description = [
    `Enquiry from ${handoff.source}.`,
    handoff.summary,
  ]
    .filter(Boolean)
    .join(" ");
  await providerJson(
    await fetch(`${REGIONS[region].api}/matters.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          description: description.slice(0, 2000),
          status: "Open",
          client: { id: contact.data.id },
        },
      }),
    }),
  );
}

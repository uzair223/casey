export type LeadHandoff = {
  event: "lead.accepted";
  statementId: string;
  contact: {
    name: string;
    email: string | null;
    phone: string | null;
  };
  summary: string;
  source: string;
};

export type PushJobResult = {
  provider: string;
  status: "sent" | "failed";
  error: string | null;
};

function hostnameIsLocal(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    return true;
  }
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) {
    return host === "::1" || host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd");
  }
  const parts = ipv4.slice(1).map((part) => Number(part));
  if (parts.some((part) => part > 255)) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

export function publicHttpsUrlError(
  value: string,
  emptyMessage = "Enter the address that should receive the lead.",
) {
  const text = value.trim();
  if (!text || text.length > 500) return emptyMessage;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return "Enter a full https address.";
  }
  if (url.protocol !== "https:") return "The address has to start with https.";
  if (url.username || url.password) return "Remove the username and password from the address.";
  if (hostnameIsLocal(url.hostname)) return "Use a public https address.";
  return null;
}

export function webhookUrlError(value: string) {
  return publicHttpsUrlError(value);
}

export function buildLeadHandoff(params: {
  statementId: string;
  name: string;
  email: string | null;
  phone: string | null;
  summary: string;
  source: string;
}): LeadHandoff {
  return {
    event: "lead.accepted",
    statementId: params.statementId,
    contact: {
      name: params.name.trim(),
      email: params.email?.trim() || null,
      phone: params.phone?.trim() || null,
    },
    summary: params.summary.trim().slice(0, 2000),
    source: params.source,
  };
}

export async function runLeadPushes(
  jobs: Array<{ provider: string; send: () => Promise<void> }>,
): Promise<PushJobResult[]> {
  const results: PushJobResult[] = [];
  for (const job of jobs) {
    try {
      await job.send();
      results.push({ provider: job.provider, status: "sent", error: null });
    } catch (error) {
      results.push({
        provider: job.provider,
        status: "failed",
        error: error instanceof Error ? error.message : "The handoff did not send.",
      });
    }
  }
  return results;
}

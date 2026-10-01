import "server-only";

export class ProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderError";
  }
}

export async function providerJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = null;
    }
  }
  if (!response.ok) {
    throw new ProviderError(providerMessage(body) || text.slice(0, 400) || `Request failed (${response.status})`);
  }
  return body as T;
}

export function providerMessage(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const record = body as {
    error?: { message?: string } | string;
    error_description?: string;
    message?: string;
  };
  if (typeof record.error_description === "string") return record.error_description.slice(0, 400);
  if (typeof record.error === "string") return record.error.slice(0, 400);
  if (record.error && typeof record.error === "object" && record.error.message) {
    return record.error.message.slice(0, 400);
  }
  if (typeof record.message === "string") return record.message.slice(0, 400);
  return null;
}

export async function postForm(url: string, fields: Record<string, string>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields),
  });
  return providerJson<{
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  }>(response);
}

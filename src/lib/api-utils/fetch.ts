import { getSupabaseClient } from "../supabase/client";

export const getAccessToken = async () => {
  const supabase = getSupabaseClient();

  if (!supabase) {
    throw new Error("Supabase client not available");
  }

  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error("User not authenticated");
  }

  return data.session.access_token;
};

type ApiFetchOptions = RequestInit & {
  requireAuth?: boolean | "optional";
  returnType?: "json" | "response";
};

const CASE_GATES = new Set([
  "starter",
  "growth",
  "extra_lead",
  "practice",
  "firm",
  "extra_case",
]);

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly gate?:
    | "starter"
    | "growth"
    | "extra_lead"
    | "practice"
    | "firm"
    | "extra_case";

  constructor(
    message: string,
    status: number,
    body: { code?: unknown; gate?: unknown } | null,
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = typeof body?.code === "string" ? body.code : undefined;
    this.gate =
      typeof body?.gate === "string" && CASE_GATES.has(body.gate)
        ? (body.gate as
            | "starter"
            | "growth"
            | "extra_lead"
            | "practice"
            | "firm"
            | "extra_case")
        : undefined;
  }
}

export async function apiFetch<T>(
  url: string,
  options?: ApiFetchOptions & { returnType?: "json" },
): Promise<T>;

export async function apiFetch(
  url: string,
  options: ApiFetchOptions & { returnType: "response" },
): Promise<Response>;

export async function apiFetch(
  url: string,
  { requireAuth = true, returnType = "json", ...options }: ApiFetchOptions = {},
) {
  const isFormDataBody =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  let authorization: Record<string, string> = {};
  if (requireAuth === true) {
    authorization = { Authorization: `Bearer ${await getAccessToken()}` };
  } else if (requireAuth === "optional") {
    try {
      authorization = { Authorization: `Bearer ${await getAccessToken()}` };
    } catch {
      authorization = {};
    }
  }

  const headers = {
    ...(isFormDataBody ? {} : { "Content-Type": "application/json" }),
    ...(options?.headers ?? {}),
    ...authorization,
  };
  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    const body =
      error && typeof error === "object"
        ? (error as { error?: unknown; code?: unknown; gate?: unknown })
        : null;
    if (body && typeof body.error === "string" && body.error.trim()) {
      throw new ApiRequestError(body.error, response.status, body);
    }

    const message =
      process.env.NODE_ENV === "development"
        ? JSON.stringify(error, null, 2)
        : "Request failed";
    throw new ApiRequestError(message, response.status, body);
  }

  if (returnType === "json") {
    return response.json();
  }
  return response;
}

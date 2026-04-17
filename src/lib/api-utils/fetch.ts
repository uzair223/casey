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
  requireAuth?: boolean;
  returnType?: "json" | "response";
};

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
  const headers = {
    "Content-Type": "application/json",
    ...(options?.headers ?? {}),
    ...(requireAuth
      ? { Authorization: `Bearer ${await getAccessToken()}` }
      : {}),
  };
  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch((err) => err);
    throw new Error(
      error.error || error.message || process.env.NODE_ENV === "development"
        ? JSON.stringify(error, null, 2)
        : "Request failed",
    );
  }

  if (returnType === "json") {
    return response.json();
  }
  return response;
}

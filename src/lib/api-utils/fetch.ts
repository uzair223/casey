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

export const apiFetch = async <T>(
  url: string,
  options?: RequestInit,
  requireAuth: boolean = true,
): Promise<T> => {
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
    throw new Error(error.error || error.message || "Request failed");
  }

  return response.json();
};

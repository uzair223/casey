import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { getSupabaseClient } from "./supabase/client";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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
): Promise<T> => {
  const token = await getAccessToken();
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Request failed");
  }

  return response.json();
};

export const withRetry = async <T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 500,
): Promise<T> => {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) throw err;
    await new Promise((res) => setTimeout(res, delay));
    return withRetry(fn, retries - 1, delay);
  }
};

export function assertServerOnly(label: string) {
  if (typeof window !== "undefined") {
    throw new Error(`${label} must be called from server-side code`);
  }
}

export function getRoleLabel(role?: string) {
  const map: Record<string, string> = {
    app_admin: "App Admin",
    tenant_admin: "Tenant Admin",
    solicitor: "Solicitor",
    paralegal: "Paralegal",
    user: "User",
  };
  return map[role ?? "user"] ?? "Unknown";
}

export const getURL = () => {
  let url =
    process.env.NEXT_PUBLIC_SITE_URL ?? // Set this to your site URL in production env.
    process.env.NEXT_PUBLIC_VERCEL_URL ?? // Automatically set by Vercel.
    "http://localhost:3000/";
  // Make sure to include `https://` when not localhost.
  url = url.startsWith("http") ? url : `https://${url}`;
  // Make sure to include a trailing `/`.
  url = url.endsWith("/") ? url : `${url}/`;
  return url;
};

export const getAuthURL = (inviteCode?: string | null) => {
  let url = `${getURL()}auth`;
  if (inviteCode) url += `?invite=${inviteCode}`;
  return url;
};

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

export function assertServerOnly(label: string) {
  if (typeof window !== "undefined") {
    throw new Error(`${label} must be called from server-side code`);
  }
}

export function getRoleLabel(role: string) {
  const map: Record<string, string> = {
    app_admin: "App Admin",
    tenant_admin: "Tenant Admin",
    solicitor: "Solicitor",
    paralegal: "Paralegal",
    user: "User",
  };
  return map[role] ?? "Unknown";
}

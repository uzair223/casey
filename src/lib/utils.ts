import { env } from "./env";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(value: string, fallback: string) {
  const cleaned = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, " ") // turn separators into spaces
    .split(" ")
    .filter(Boolean);

  if (cleaned.length === 0) return fallback;

  const camel = cleaned
    .map((word, i) =>
      i === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join("");

  return camel;
}

export function uniqueSlug(base: string, used: Set<string>) {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }

  let suffix = 2;
  while (used.has(`${base}${suffix}`)) {
    suffix += 1;
  }

  const next = `${base}${suffix}`;
  used.add(next);
  return next;
}

export function assertServerOnly(source: string = "function") {
  if (typeof window !== "undefined") {
    throw new Error(`${source} must be called from server-side code`);
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
    env.NEXT_PUBLIC_SITE_URL ?? // Set this to your site URL in production env.
    env.NEXT_PUBLIC_VERCEL_URL ?? // Automatically set by Vercel.
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

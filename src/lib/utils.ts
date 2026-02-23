import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { UserRole } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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

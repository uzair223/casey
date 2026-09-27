import { env } from "@/lib/env";
import { firmPageUrl } from "@/lib/firm-page-host";

export function enquiryVerificationCode(message: string) {
  const trimmed = message.trim();
  if (/^\d{6}$/.test(trimmed)) return trimmed;
  const matches = trimmed.match(/\b\d{6}\b/g);
  if (matches?.length === 1) return matches[0];
  return null;
}

export function messageLooksLikeEnquiryCode(message: string) {
  return /\bcode\b/i.test(message) && enquiryVerificationCode(message) !== null;
}

export function enquiryResumeUrl(params: {
  slug: string | null | undefined;
  token: string;
}) {
  const session = encodeURIComponent(params.token);
  const slug = params.slug?.trim().toLowerCase() ?? "";
  if (slug && process.env.NODE_ENV === "production") {
    return `${firmPageUrl(slug)}/?session=${session}`;
  }
  const base = env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "");
  if (slug) return `${base}/q/${encodeURIComponent(slug)}?session=${session}`;
  return `${base}/q?session=${session}`;
}

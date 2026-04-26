import type { NextConfig } from "next";
import { BuildEnvSchema } from "./src/lib/env";

const buildEnvResult = BuildEnvSchema.safeParse(process.env);

if (!buildEnvResult.success) {
  const details = buildEnvResult.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment for Next.js config:\n${details}`);
}

const supabaseHostname = (() => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return undefined;

  try {
    return new URL(supabaseUrl).hostname;
  } catch {
    return undefined;
  }
})();

const cspEnforce =
  process.env.CSP_ENFORCE === "1" ||
  process.env.CSP_ENFORCE === "true" ||
  process.env.CSP_ENFORCE === "TRUE";

const connectSrc = [
  "'self'",
  ...(supabaseHostname
    ? [`https://${supabaseHostname}`, `wss://${supabaseHostname}`]
    : []),
].join(" ");

const imgSrc = [
  "'self'",
  "data:",
  "blob:",
  ...(supabaseHostname ? [`https://${supabaseHostname}`] : []),
].join(" ");

const cspPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  `img-src ${imgSrc}`,
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  `connect-src ${connectSrc}`,
  "worker-src 'self' blob:",
  "frame-src 'self'",
  "report-uri /api/security/csp-report",
  "report-to csp-endpoint",
  "upgrade-insecure-requests",
].join("; ");

const cspReportTo = JSON.stringify({
  group: "csp-endpoint",
  max_age: 60 * 60 * 24 * 7,
  endpoints: [{ url: "/api/security/csp-report" }],
});

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          { key: "Report-To", value: cspReportTo },
          {
            key: "Reporting-Endpoints",
            value: 'csp-endpoint="/api/security/csp-report"',
          },
          {
            key: cspEnforce
              ? "Content-Security-Policy"
              : "Content-Security-Policy-Report-Only",
            value: cspPolicy,
          },
        ],
      },
    ];
  },
  images: {
    qualities: [20, 35, 75, 80],
    remotePatterns: supabaseHostname
      ? [
          {
            protocol: "https",
            hostname: supabaseHostname,
          },
        ]
      : [],
  },
};

export default nextConfig;

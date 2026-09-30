import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
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
  process.env.CSP_ENFORCE === "TRUE" ||
  (process.env.NODE_ENV === "production" &&
    process.env.CSP_ENFORCE !== "0" &&
    process.env.CSP_ENFORCE !== "false");

const connectSrc = [
  "'self'",
  "https://js.stripe.com",
  "https://api.stripe.com",
  "https://challenges.cloudflare.com",
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

function cspPolicy(frameable: boolean) {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    frameable ? "frame-ancestors *" : "frame-ancestors 'none'",
    `object-src 'self' blob:${
      supabaseHostname ? ` https://${supabaseHostname}` : ""
    }`,
    `img-src ${imgSrc}`,
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline' https://js.stripe.com https://challenges.cloudflare.com",
    `connect-src ${connectSrc}`,
    "worker-src 'self' blob:",
    `frame-src 'self' blob:${
      supabaseHostname ? ` https://${supabaseHostname}` : ""
    } https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com`,
    "report-uri /api/security/csp-report",
    "report-to csp-endpoint",
    "upgrade-insecure-requests",
  ].join("; ");
}

function securityHeaders(frameable: boolean) {
  return [
    { key: "X-Content-Type-Options", value: "nosniff" },
    ...(frameable ? [] : [{ key: "X-Frame-Options", value: "DENY" }]),
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
      value: cspPolicy(frameable),
    },
  ];
}

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
        source: "/widget/:path*",
        headers: securityHeaders(true),
      },
      {
        source: "/((?!widget(?:/|$)).*)",
        headers: securityHeaders(false),
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

initOpenNextCloudflareForDev();

export default nextConfig;

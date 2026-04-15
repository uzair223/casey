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

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
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

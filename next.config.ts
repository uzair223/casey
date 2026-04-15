import type { NextConfig } from "next";
import { env } from "@/lib/env";

const supabaseHostname = (() => {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;

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

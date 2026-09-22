import Link from "next/link";
import type { ReactNode } from "react";

import { BrandMark } from "@/components/brand-mark";
import { HeroGlow } from "@/components/marketing/hero-glow";
import { SkipLink } from "@/components/skip-link";
import { env } from "@/lib/env";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <HeroGlow />
      <SkipLink />
      <header className="relative z-10 flex h-[68px] items-center justify-between px-6 sm:px-10 lg:px-12">
        <Link href="/" className="flex items-center gap-2.5">
          <BrandMark />
          <span className="font-display text-[22px] leading-none tracking-tight">
            {env.NEXT_PUBLIC_APP_NAME}
          </span>
        </Link>
        <Link
          href="/"
          className="text-sm text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          Back to site
        </Link>
      </header>
      <main
        id="main-content"
        className="relative z-10 mx-auto w-full max-w-[1536px] px-6 pb-24 pt-8 sm:px-10 lg:px-12"
      >
        {children}
      </main>
    </div>
  );
}

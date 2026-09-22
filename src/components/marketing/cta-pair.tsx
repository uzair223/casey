import Link from "next/link";

import { env } from "@/lib/env";
import { cn } from "@/lib/utils";

type CtaPairProps = {
  className?: string;
  size?: "default" | "lg";
  primaryHref?: string;
  primaryLabel?: string;
  tone?: "dark" | "light";
};

export function getDemoHref() {
  return env.NEXT_PUBLIC_CALENDLY_LINK || "/#early-access";
}

export function CtaPair({
  className,
  size = "lg",
  primaryHref = "/#early-access",
  primaryLabel = "Get Started",
  tone = "dark",
}: CtaPairProps) {
  const demoHref = getDemoHref();
  const demoIsExternal = Boolean(env.NEXT_PUBLIC_CALENDLY_LINK);
  const hero = size === "lg";
  const onLight = tone === "light";

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <Link
        href={primaryHref}
        className={cn(
          "inline-flex items-center justify-center rounded-full bg-brand-fill font-medium text-brand-foreground transition-opacity hover:opacity-90",
          hero
            ? "h-11 px-7 text-xl"
            : "h-[34px] px-4 text-[14px]",
        )}
      >
        {primaryLabel}
      </Link>
      <Link
        href={demoHref}
        target={demoIsExternal ? "_blank" : undefined}
        rel={demoIsExternal ? "noreferrer" : undefined}
        className={cn(
          "inline-flex items-center justify-center rounded-full border font-medium transition-colors",
          hero ? "h-11 px-7 text-lg" : "h-[34px] px-4 text-[14px]",
          onLight
            ? "border-[#12110f]/25 text-[#12110f] hover:bg-[#12110f]/5"
            : "border-primary/30 text-primary hover:bg-primary/5",
        )}
      >
        Book a demo
      </Link>
    </div>
  );
}

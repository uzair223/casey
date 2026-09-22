"use client";

import { usePathname } from "next/navigation";

function isMarketingPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname.startsWith("/platform") ||
    pathname.startsWith("/legal")
  );
}

export function PrismStreak() {
  const pathname = usePathname();

  if (!isMarketingPath(pathname)) return null;

  return <div className="prism-bg" aria-hidden />;
}

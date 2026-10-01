"use client";

import Link from "next/link";

import { PageTitle } from "@/components/page-title";
import { Button } from "@/components/ui/button";

const LINKS = [
  { label: "Home", href: "/dashboard/marketing" },
  { label: "Firm", href: "/dashboard/marketing/firm" },
  { label: "Widget", href: "/dashboard/marketing/widget" },
  { label: "Creative", href: "/dashboard/marketing/creative" },
];

export function MarketingFrame({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <PageTitle title={title} description={description} />
      <nav className="flex flex-wrap gap-2">
        {LINKS.map((link) => (
          <Button key={link.href} asChild variant="outline" size="sm">
            <Link href={link.href}>{link.label}</Link>
          </Button>
        ))}
      </nav>
      {children}
    </section>
  );
}

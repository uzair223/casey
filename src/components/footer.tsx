import { env } from "@/lib/env";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { LinkList } from "./ui/link-list";

export default function Footer() {
  return (
    <footer className="border-t border-border/50 pt-20 pb-10">
      <div className="container grid gap-12 sm:grid-cols-2 lg:grid-cols-[1.15fr_repeat(4,minmax(0,1fr))]">
        <div className="max-w-sm space-y-3">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandMark />
            <p className="font-display text-[22px] leading-none tracking-tight">
              {env.NEXT_PUBLIC_APP_NAME}
            </p>
          </Link>
          <p className="text-sm leading-6 text-muted-foreground">
            Witness statements without the chasing. Built for UK claimant firms.
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-foreground">Product</p>
          <div className="flex flex-col gap-1 text-muted-foreground">
            <LinkList
              items={[
                { label: "Platform", href: "/platform" },
                { label: "Security", href: "/legal/security" },
                { label: "Early access", href: "/#early-access" },
                { label: "Witness intake demo", href: "/intake/demo" },
              ]}
            />
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-foreground">Company</p>
          <div className="flex flex-col gap-1 text-muted-foreground">
            <LinkList
              items={[
                { label: "Home", href: "/" },
                { label: "Dashboard", href: "/dashboard" },
                { label: "Sign in", href: "/auth" },
              ]}
            />
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-foreground">Support</p>
          <div className="flex flex-col gap-1 text-muted-foreground">
            {env.NEXT_PUBLIC_CALENDLY_LINK ? (
              <Button
                size={null}
                variant="link"
                className="justify-start px-0"
                asChild
              >
                <Link href={env.NEXT_PUBLIC_CALENDLY_LINK} target="_blank">
                  Book a demo
                </Link>
              </Button>
            ) : (
              <Button
                size={null}
                variant="link"
                className="justify-start px-0"
                asChild
              >
                <Link href="/#early-access">Book a demo</Link>
              </Button>
            )}
            {env.NEXT_PUBLIC_SUPPORT_EMAIL ? (
              <Button
                size={null}
                variant="link"
                className="justify-start px-0"
                asChild
              >
                <Link href={`mailto:${env.NEXT_PUBLIC_SUPPORT_EMAIL}`}>
                  Contact
                </Link>
              </Button>
            ) : null}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-foreground">Legal</p>
          <div className="flex flex-col gap-1 text-muted-foreground">
            <LinkList
              items={[
                { label: "Terms of service", href: "/legal/terms" },
                { label: "Privacy policy", href: "/legal/privacy" },
                { label: "GDPR notice", href: "/legal/gdpr" },
                { label: "DPA", href: "/legal/dpa" },
              ]}
            />
          </div>
        </div>
      </div>
      <p className="container mt-16 text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} {env.NEXT_PUBLIC_APP_NAME}. All rights
        reserved.
      </p>
    </footer>
  );
}

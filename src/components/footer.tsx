import { env } from "@/lib/env";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { WaitlistSignupForm } from "./waitlist/waitlist-form";
import { LinkList } from "./ui/link-list";

export default function Footer() {
  return (
    <footer className="mt-8 border-t bg-background/60 pt-8 pb-4">
      <div className="container flex gap-x-24 gap-y-12 justify-center flex-wrap">
        <div className="min-w-md max-w-xl flex-1 space-y-6">
          <div>
            <p className="font-display text-xl">
              Witness statements, without the chaos.
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              Purpose-built for legal professionals handling witness statements,
              case preparation, and compliant data processing in the UK.
            </p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-accent-foreground">
              Early access
            </p>
            <p className="font-display text-xl">Join the waiting list</p>
            <p className="text-sm leading-6 text-muted-foreground mb-4">
              Register your interest and we&apos;ll invite you to onboard.
            </p>
            <WaitlistSignupForm id="waitlist" disableCalendly />
          </div>
        </div>

        <div className="md:ml-auto flex gap-12">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-accent-foreground">
              Support
            </p>
            <div className="flex flex-col gap-1 text-muted-foreground">
              {env.NEXT_PUBLIC_CALENDLY_LINK && (
                <Button
                  size={null}
                  variant="link"
                  className="justify-start px-0"
                  asChild
                >
                  <Link href={env.NEXT_PUBLIC_CALENDLY_LINK} target="_blank">
                    Book a demo call
                  </Link>
                </Button>
              )}
              {env.NEXT_PUBLIC_SUPPORT_EMAIL && (
                <Button
                  size={null}
                  variant="link"
                  className="justify-start px-0"
                  asChild
                >
                  <Link href={`mailto:${env.NEXT_PUBLIC_SUPPORT_EMAIL}`}>
                    {env.NEXT_PUBLIC_SUPPORT_EMAIL}
                  </Link>
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-accent-foreground">
              Compliance
            </p>
            <div className="flex flex-col gap-1 text-muted-foreground">
              {[
                { label: "Privacy Policy", href: "/legal/privacy" },
                { label: "GDPR Notice", href: "/legal/gdpr" },
                { label: "Security Policy", href: "/legal/security" },
              ].map((item) => (
                <Button
                  key={item.label}
                  size={null}
                  variant="link"
                  className="justify-start px-0"
                  asChild
                >
                  <Link href={item.href}>{item.label}</Link>
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-accent-foreground">
              Product
            </p>
            <div className="flex flex-col gap-1 text-muted-foreground">
              <LinkList
                items={[
                  { label: "Home", href: "/" },
                  { label: "Witness Intake Demo", href: "/intake/demo" },
                  { label: "Dashboard", href: "/dashboard" },
                ]}
              />
            </div>
          </div>
        </div>
      </div>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} {env.NEXT_PUBLIC_APP_NAME}. All rights
        reserved.
      </p>
    </footer>
  );
}

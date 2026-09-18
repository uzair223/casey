"use client";
import { env } from "@/lib/env";
import { BrandMark } from "@/components/brand-mark";
import { useState } from "react";
import Link from "next/link";
import { BellIcon, MenuIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import { useUser } from "@/contexts/user-context";

const publicLinks = [
  { label: "Platform", href: "/platform" },
  { label: "Security", href: "/legal/security" },
] as const;

export default function Header() {
  const { user, signOut } = useUser();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "app_admin":
        return "App Admin";
      case "tenant_admin":
        return "Firm Admin";
      case "solicitor":
        return "Solicitor";
      case "paralegal":
        return "Paralegal";
      default:
        return "";
    }
  };

  const demoHref = env.NEXT_PUBLIC_CALENDLY_LINK || "/#early-access";
  const demoIsExternal = Boolean(env.NEXT_PUBLIC_CALENDLY_LINK);

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-[var(--header-height)] bg-[#101010]">
      <div className="container flex h-full items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          {user?.tenant_name ? (
            <div>
              <p className="text-[11px] uppercase leading-none tracking-[0.18em] text-muted-foreground">
                {user.tenant_name}
              </p>
              <p className="font-display text-[22px] leading-none tracking-tight">
                {env.NEXT_PUBLIC_APP_NAME}
              </p>
            </div>
          ) : (
            <>
              <BrandMark />
              <p className="font-display text-[22px] leading-none tracking-tight">
                {env.NEXT_PUBLIC_APP_NAME}
              </p>
            </>
          )}
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {user ? (
            <>
              <Button size={null} variant="link" asChild>
                <Link href="/dashboard">Dashboard</Link>
              </Button>
              <Button size={null} variant="link" asChild>
                <Link href="/notifications">Notifications</Link>
              </Button>
              <Button size={null} variant="link" asChild>
                <Link href="/settings">Settings</Link>
              </Button>
              <div className="relative -mt-4 flex flex-col items-end gap-0.5 text-sm">
                {user.role && (
                  <p className="text-xs text-muted-foreground">
                    {getRoleLabel(user.role)}
                  </p>
                )}
                <p className="font-medium text-foreground">
                  {user.display_name ?? user.email}
                </p>
              </div>
              <AsyncButton
                size="sm"
                variant="outline"
                onClick={handleSignOut}
                pendingText="Signing out..."
              >
                Sign out
              </AsyncButton>
            </>
          ) : (
            <>
              {publicLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-[10px] px-3 py-2 text-[13px] text-primary/60 transition-colors hover:text-primary"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/auth"
                className="rounded-[10px] px-3 py-2 text-[13px] text-primary/60 transition-colors hover:text-primary"
              >
                Login
              </Link>
              <Link
                href={demoHref}
                target={demoIsExternal ? "_blank" : undefined}
                rel={demoIsExternal ? "noreferrer" : undefined}
                className="ml-1 inline-flex h-[34px] items-center rounded-full border border-primary/30 px-4 text-[14px] font-medium text-primary"
              >
                Book a demo
              </Link>
              <Link
                href="/#early-access"
                className="inline-flex h-[34px] items-center rounded-full bg-brand px-4 text-[14px] font-medium text-brand-foreground"
              >
                Get Started
              </Link>
            </>
          )}
        </nav>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
          onClick={() => setIsMobileMenuOpen((prev) => !prev)}
        >
          {isMobileMenuOpen ? (
            <XIcon className="h-5 w-5" />
          ) : (
            <MenuIcon className="h-5 w-5" />
          )}
        </Button>
      </div>

      {isMobileMenuOpen ? (
        <div className="absolute inset-x-0 top-full rounded-b-xl bg-[#101010] md:hidden">
          <nav className="container flex flex-col gap-1 pb-6 text-sm">
            {user ? (
              <>
                <Button
                  variant="ghost"
                  className="justify-start"
                  asChild
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Link href="/dashboard">Dashboard</Link>
                </Button>
                <Button
                  variant="ghost"
                  className="justify-start"
                  asChild
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Link href="/notifications">
                    <BellIcon />
                    Notifications
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  className="justify-start"
                  asChild
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Link href="/settings">Settings</Link>
                </Button>
                <div className="mt-3 border-t pt-3">
                  <p className="text-sm font-medium text-foreground">
                    {user.email}
                  </p>
                  {user.role ? (
                    <p className="text-xs text-muted-foreground">
                      {getRoleLabel(user.role)}
                    </p>
                  ) : null}
                </div>
                <AsyncButton
                  size="sm"
                  variant="outline"
                  className="mt-2 w-full"
                  onClick={async () => {
                    await handleSignOut();
                    setIsMobileMenuOpen(false);
                  }}
                  pendingText="Signing out..."
                >
                  Sign out
                </AsyncButton>
              </>
            ) : (
              <>
                {publicLinks.map((item) => (
                  <Button
                    key={item.href}
                    variant="ghost"
                    className="justify-start"
                    asChild
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Link href={item.href}>{item.label}</Link>
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  className="justify-start"
                  asChild
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Link href="/auth">Login</Link>
                </Button>
                <Button
                  variant="outline"
                  className="mt-2 rounded-full"
                  asChild
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Link
                    href={demoHref}
                    target={demoIsExternal ? "_blank" : undefined}
                    rel={demoIsExternal ? "noreferrer" : undefined}
                  >
                    Book a demo
                  </Link>
                </Button>
                <Button
                  className="rounded-full bg-brand text-brand-foreground hover:bg-brand/90"
                  asChild
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Link href="/#early-access">Get Started</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      ) : null}
    </header>
  );
}

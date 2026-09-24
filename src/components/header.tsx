"use client";
import { env } from "@/lib/env";
import { BrandMark } from "@/components/brand-mark";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  BellIcon,
  HouseIcon,
  LogOutIcon,
  MenuIcon,
  MessageSquareIcon,
  SettingsIcon,
  XIcon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import { PersonAvatar } from "@/components/person-avatar";
import { FeedbackDialog } from "@/components/feedback/feedback-dialog";
import { useUser } from "@/contexts/user-context";
import { getRoleLabel } from "@/lib/utils";
import { getUnreadNotificationCount } from "@/lib/supabase/queries";
import { useAsync } from "@/hooks/useAsync";
import type { User } from "@/types";

const NAV_LINK_CLASS =
  "rounded-[10px] px-3 py-2 text-[13px] text-primary/60 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

const publicLinks = [
  { label: "Platform", href: "/platform" },
  { label: "Billing", href: "/#billing" },
  { label: "Security", href: "/legal/security" },
] as const;

export default function Header() {
  const { user, signOut } = useUser();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const demoHref = env.NEXT_PUBLIC_CALENDLY_LINK || "/#early-access";
  const demoIsExternal = Boolean(env.NEXT_PUBLIC_CALENDLY_LINK);

  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const firstLink = mobileMenuRef.current?.querySelector("a");
    firstLink?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMobileMenuOpen(false);
        mobileMenuButtonRef.current?.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isMobileMenuOpen]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-[var(--header-height)] bg-background">
      <div className="container flex h-full items-center justify-between">
        <Link
          href="/"
          prefetch={false}
          className="flex h-10 items-center gap-2.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {user?.tenant_name ? (
            <div>
              <p className="text-[11px] uppercase leading-none tracking-[0.18em] text-muted-foreground">
                {user.tenant_name}
              </p>
              <p className="font-display text-[20px] leading-none tracking-tight">
                {env.NEXT_PUBLIC_APP_NAME}
              </p>
            </div>
          ) : (
            <>
              <BrandMark className="size-7" />
              <p className="font-display text-[20px] leading-none tracking-tight">
                {env.NEXT_PUBLIC_APP_NAME}
              </p>
            </>
          )}
        </Link>

        {user ? (
          <LoggedInNav user={user} onSignOut={handleSignOut} />
        ) : (
          <>
            <nav className="hidden items-center gap-5 md:flex">
              {publicLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                  className={NAV_LINK_CLASS}
                >
                  {item.label}
                </Link>
              ))}
              <Link href="/auth" prefetch={false} className={NAV_LINK_CLASS}>
                Login
              </Link>
              <Link
                href={demoHref}
                prefetch={false}
                target={demoIsExternal ? "_blank" : undefined}
                rel={demoIsExternal ? "noreferrer" : undefined}
                className="ml-1 inline-flex h-[34px] items-center rounded-full border border-primary/30 px-4 text-[14px] font-medium text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                Book a demo
              </Link>
              <Link
                href="/#early-access"
                prefetch={false}
                className="inline-flex h-[34px] items-center rounded-full bg-brand-fill px-4 text-[14px] font-medium text-brand-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                Get Started
              </Link>
            </nav>

            <Button
              ref={mobileMenuButtonRef}
              type="button"
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-nav"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            >
              {isMobileMenuOpen ? (
                <XIcon className="h-5 w-5" />
              ) : (
                <MenuIcon className="h-5 w-5" />
              )}
            </Button>
          </>
        )}
      </div>

      {!user && isMobileMenuOpen ? (
        <div
          ref={mobileMenuRef}
          id="mobile-nav"
          className="absolute inset-x-0 top-full bg-background md:hidden"
        >
          <nav className="container flex flex-col gap-1 pb-6 text-sm">
            {publicLinks.map((item) => (
              <Button
                key={item.href}
                variant="ghost"
                className="justify-start"
                asChild
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Link href={item.href} prefetch={false}>
                  {item.label}
                </Link>
              </Button>
            ))}
            <Button
              variant="ghost"
              className="justify-start"
              asChild
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <Link href="/auth" prefetch={false}>
                Login
              </Link>
            </Button>
            <Button
              variant="outline"
              className="mt-2 rounded-full"
              asChild
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <Link
                href={demoHref}
                prefetch={false}
                target={demoIsExternal ? "_blank" : undefined}
                rel={demoIsExternal ? "noreferrer" : undefined}
              >
                Book a demo
              </Link>
            </Button>
            <Button
              className="rounded-full bg-brand-fill text-brand-foreground hover:bg-brand-fill/90"
              asChild
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <Link href="/#early-access" prefetch={false}>
                Get Started
              </Link>
            </Button>
          </nav>
        </div>
      ) : null}
    </header>
  );
}

function LoggedInNav({
  user,
  onSignOut,
}: {
  user: User;
  onSignOut: () => Promise<void>;
}) {
  return (
    <nav className="flex h-10 items-center gap-3">
      <Button
        variant="ghost"
        className="size-10 text-primary/80 hover:text-primary [&_svg]:!size-7"
        asChild
      >
        <Link href="/dashboard" aria-label="Home">
          <HouseIcon />
        </Link>
      </Button>
      <UserMenu user={user} onSignOut={onSignOut} />
    </nav>
  );
}

function UserMenu({
  user,
  onSignOut,
}: {
  user: User;
  onSignOut: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const displayName = user.display_name ?? user.email ?? "Account";
  const roleLabel = user.role ? getRoleLabel(user.role) : "";

  const { data: unreadCount, handler: refreshUnreadCount } = useAsync(
    getUnreadNotificationCount,
    [],
    { initialState: 0, enabled: true },
  );

  useEffect(() => {
    if (open) {
      void refreshUnreadCount();
    }
  }, [open, refreshUnreadCount]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const closeMenu = () => setOpen(false);

  return (
    <>
      <div ref={wrapRef} className="relative">
      <Button
        ref={buttonRef}
        type="button"
        variant="ghost"
        className="relative size-10 overflow-visible rounded-full text-primary/80 hover:text-primary [&_svg]:!size-7"
        aria-label={
          unreadCount > 0
            ? `Account menu, ${unreadCount} unread notifications`
            : "Account menu"
        }
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls="account-menu"
        onClick={() => setOpen((current) => !current)}
      >
        <PersonAvatar
          name={user.id}
          title={displayName}
          size={28}
          background="circle"
        />
        {unreadCount > 0 ? (
          <span
            aria-hidden
            className="absolute right-1 top-1 h-2 w-2 rounded-full bg-brand-fill"
          />
        ) : null}
      </Button>

      {open ? (
        <div
          id="account-menu"
          className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-lg"
        >
          <div className="flex items-center gap-2.5 px-3 py-2">
            <PersonAvatar
              name={user.id}
              title={displayName}
              size={32}
              background="circle"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium leading-none">
                {displayName}
              </p>
              {roleLabel ? (
                <p className="mt-1.5 text-xs leading-none text-muted-foreground">
                  {roleLabel}
                </p>
              ) : null}
            </div>
          </div>
          <div className="my-1 h-px bg-border" />
          <Link
            href="/notifications"
            className="relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            onClick={closeMenu}
          >
            <BellIcon className="h-4 w-4 shrink-0" />
            <span className="relative pr-5">
              Notifications
              {unreadCount > 0 ? (
                <span className="absolute -right-1 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-fill px-1 text-[10px] font-semibold leading-none text-brand-foreground">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </span>
          </Link>
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            onClick={() => {
              closeMenu();
              setFeedbackOpen(true);
            }}
          >
            <MessageSquareIcon className="h-4 w-4 shrink-0" />
            Feedback
          </button>
          <Link
            href="/settings"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            onClick={closeMenu}
          >
            <SettingsIcon className="h-4 w-4 shrink-0" />
            Settings
          </Link>
          <AsyncButton
            size={null}
            variant="ghost"
            className="h-auto w-full justify-start gap-2.5 rounded-lg px-3 py-2 text-sm font-normal"
            onClick={async () => {
              closeMenu();
              await onSignOut();
            }}
            pendingText="Signing out..."
          >
            <LogOutIcon className="h-4 w-4 shrink-0" />
            Sign Out
          </AsyncButton>
        </div>
      ) : null}
      </div>
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </>
  );
}

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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import { PersonAvatar } from "@/components/person-avatar";
import { FeedbackDialog } from "@/components/feedback/feedback-dialog";
import { useUser } from "@/contexts/user-context";
import { getRoleLabel } from "@/lib/utils";
import { getUnreadNotificationCount } from "@/lib/supabase/queries";
import { useAsync } from "@/hooks/useAsync";
import type { User } from "@/types";

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

        {user ? (
          <LoggedInNav user={user} onSignOut={handleSignOut} />
        ) : (
          <>
            <nav className="hidden items-center gap-5 md:flex">
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
                className="inline-flex h-[34px] items-center rounded-full bg-brand-fill px-4 text-[14px] font-medium text-brand-foreground"
              >
                Get Started
              </Link>
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
          </>
        )}
      </div>

      {!user && isMobileMenuOpen ? (
        <div className="absolute inset-x-0 top-full rounded-b-xl bg-[#101010] md:hidden">
          <nav className="container flex flex-col gap-1 pb-6 text-sm">
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
              className="rounded-full bg-brand-fill text-brand-foreground hover:bg-brand-fill/90"
              asChild
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <Link href="/#early-access">Get Started</Link>
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
    <nav className="flex items-center gap-1">
      <Button
        size="icon"
        variant="ghost"
        className="text-primary/80 hover:text-primary"
        asChild
      >
        <Link href="/dashboard" aria-label="Home">
          <HouseIcon className="h-5 w-5" />
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
  const [pinned, setPinned] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const ignoreHoverRef = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);
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
        setPinned(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setPinned(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const closeMenu = () => {
    setOpen(false);
    setPinned(false);
  };

  return (
    <>
      <div
        ref={wrapRef}
        className="relative"
      onPointerEnter={(event) => {
        if (event.pointerType !== "mouse" || ignoreHoverRef.current) return;
        setOpen(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== "mouse") return;
        ignoreHoverRef.current = false;
        if (!pinned) setOpen(false);
      }}
    >
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="relative overflow-visible text-primary/80 hover:text-primary [&_svg]:size-7"
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => {
          if (open) {
            ignoreHoverRef.current = true;
            setOpen(false);
            setPinned(false);
            return;
          }
          setPinned(true);
          setOpen(true);
        }}
      >
        <PersonAvatar name={user.id} title={displayName} size={28} />
        {unreadCount > 0 ? (
          <span
            aria-hidden
            className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand-fill"
          />
        ) : null}
      </Button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-lg"
        >
          <div className="flex items-center gap-2.5 px-3 py-2">
            <PersonAvatar name={user.id} title={displayName} size={28} />
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
            role="menuitem"
            className="relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent"
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
            role="menuitem"
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
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
            role="menuitem"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent"
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

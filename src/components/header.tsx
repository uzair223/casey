"use client";
import { env } from "@/lib/env";
import { useState } from "react";
import Link from "next/link";
import { BellIcon, MenuIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import { useUser } from "@/contexts/user-context";
import { cn } from "@/lib/utils";

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
        return "Admin";
      case "solicitor":
        return "Solicitor";
      case "paralegal":
        return "Paralegal";
      default:
        return "";
    }
  };

  return (
    <header
      className={cn(
        "relative h-(--header-height) flex container items-center justify-between z-50",
        isMobileMenuOpen &&
          "max-md:sticky max-md:bg-background/95 max-md:top-0",
      )}
    >
      <Link href="/">
        <p className="text-sm uppercase leading-[0.8em] tracking-[0.2em] text-muted-foreground">
          {user?.tenant_name ?? env.NEXT_PUBLIC_APP_NAME}
        </p>
        <p className="font-display text-xl">Statement Studio</p>
      </Link>

      <nav className="hidden md:flex items-center gap-6 text-sm font-semibold">
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
            <div className="relative flex flex-col items-end gap-0.5 text-sm -mt-4">
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
          <Button size={null} variant="link" asChild>
            <Link href="/auth">Sign in</Link>
          </Button>
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

      {isMobileMenuOpen ? (
        <div className="absolute left-0 right-0 top-full border-b bg-background/95 rounded-b-xl md:hidden">
          <nav className="container pb-6 flex flex-col gap-1 text-sm">
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
              <Button
                variant="ghost"
                className="justify-start"
                asChild
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Link href="/auth">Sign in</Link>
              </Button>
            )}
          </nav>
        </div>
      ) : null}
    </header>
  );
}

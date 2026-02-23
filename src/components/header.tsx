"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AsyncButton } from "@/components/ui/async-button";
import { useUser } from "@/contexts/UserContext";

export default function Header() {
  const { user, isLoading: userLoading, signOut } = useUser();

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
    <header className="flex container py-6 items-center justify-between">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
          {process.env.NEXT_PUBLIC_APP_NAME}
        </p>
        <p className="font-display text-xl">Statement Studio</p>
      </div>
      <nav className="flex items-center gap-6 text-sm font-semibold">
        <Button size={null} variant="link" asChild>
          <Link href="/">Home</Link>
        </Button>
        <Button size={null} variant="link" asChild>
          <Link href="/dashboard">Dashboard</Link>
        </Button>
        {user &&
          (user.role === "tenant_admin" || user.role === "solicitor") && (
            <Button size={null} variant="link" asChild>
              <Link href="/team">Team</Link>
            </Button>
          )}
        {user &&
          (user.role === "tenant_admin" ||
            user.role === "solicitor" ||
            user.role === "paralegal") && (
            <Button size={null} variant="link" asChild>
              <Link href="/cases">Cases</Link>
            </Button>
          )}
        {user && (
          <>
            <div className="relative flex flex-col items-end gap-0.5 text-sm">
              <span className="font-medium text-foreground">
                {user.display_name}
              </span>
              {user.role && (
                <span className="absolute left-0 top-[-1.4em] text-xs text-muted-foreground">
                  {getRoleLabel(user.role)}
                </span>
              )}
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
        )}
      </nav>
    </header>
  );
}

"use client";

import { createContext, useContext, ReactNode, useEffect } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { getCurrentUserProfile } from "@/lib/supabase/queries/auth";
import { useRouter } from "next/navigation";
import { User, UserRole } from "@/lib/types";
import { useAsync } from "@/hooks/useAsync";

interface UserContextValue {
  user?: User | null;
  isLoading: boolean;
  signOut: () => Promise<unknown>;
  refreshUser: () => Promise<unknown>;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const supabase = getSupabaseClient();

  const {
    data: user,
    isLoading,
    handler,
    reset,
  } = useAsync(
    async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        return;
      }
      // Fetch user profile to get role and tenant_id
      const profile = await getCurrentUserProfile(session.user.id);
      console.log("Setting user:", profile);
      return { ...session.user, ...profile };
    },
    [supabase],
    {
      withUseEffect: false,
      onlyInitialLoading: true,
    },
  );

  useEffect(() => {
    handler();

    if (!supabase) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        reset();
      } else if (session?.user) {
        handler();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, handler]);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      reset();
      router.push("/auth");
    } catch (error) {
      console.error("Error signing out:", error);
      throw error;
    }
  };

  return (
    <UserContext.Provider
      value={{ user, isLoading, signOut, refreshUser: handler }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser(
  role?: UserRole | UserRole[],
  options: { redirectTo: string } = { redirectTo: "/auth" },
) {
  const router = useRouter();
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  if (!context.isLoading && role && context.user) {
    const roles = Array.isArray(role) ? role : [role];
    if (!roles.includes(context.user.role)) {
      if (options.redirectTo) {
        router.push(options.redirectTo);
      }
      return { ...context, user: null };
    }
  }
  return context;
}

// Helper hooks for common use cases
export function useUserRole() {
  const { user } = useUser();
  return user?.role || "user";
}

export function useIsTenantAdmin() {
  const { user } = useUser();
  return user?.role === "tenant_admin";
}

export function useIsSolicitor() {
  const { user } = useUser();
  return user?.role === "solicitor";
}

export function useCanManageTeam() {
  const { user } = useUser();
  return user?.role === "tenant_admin" || user?.role === "solicitor";
}

export function useCanManageCases() {
  const { user } = useUser();
  return (
    user?.role === "tenant_admin" ||
    user?.role === "solicitor" ||
    user?.role === "paralegal"
  );
}

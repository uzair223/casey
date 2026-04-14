"use client";

import { createContext, useContext, ReactNode, useEffect } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { getCurrentUserProfile } from "@/lib/supabase/queries";
import { useRouter } from "next/navigation";
import { useAsync } from "@/hooks/useAsync";

import type { User, UserRole } from "@/types";

export type UserContextValue = {
  user?: User | null;
  isLoading: boolean;
  signOut: () => Promise<unknown>;
  refreshUser: () => Promise<unknown>;
};

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const supabase = getSupabaseClient();

  const {
    data: user,
    isLoading,
    handler,
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
      return { ...session.user, ...profile };
    },
    [supabase],
    {
      debugName: "UserContext",
      withUseEffect: false,
      onlyFirstLoad: true,
    },
  );

  useEffect(() => {
    handler();

    if (!supabase) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        void handler();
      } else if (session?.user) {
        void handler();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, handler]);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      await handler();
      router.replace("/auth");
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

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}

export function useUserProtected(
  role: UserRole | UserRole[],
  options: { redirectTo: string } = { redirectTo: "/auth" },
) {
  const router = useRouter();
  const context = useUser();
  const { user, isLoading } = context;

  useEffect(() => {
    if (isLoading) {
      return;
    }
    const requiredRoles = Array.isArray(role) ? role : [role];
    if (!user || !requiredRoles.includes(user.role)) {
      router.replace(options.redirectTo);
      return;
    }
  }, [user, isLoading, role, options.redirectTo, router]);

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

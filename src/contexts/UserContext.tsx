"use client";

import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
  useCallback,
} from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { getCurrentUserProfile } from "@/lib/supabase/queries";
import { useRouter } from "next/navigation";
import { User, UserRole } from "@/lib/types";

interface UserContextValue {
  user: User | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const supabase = getSupabaseClient();

  const fetchUser = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setUser(null);
        setIsLoading(false);
        return;
      }
      // Fetch user profile to get role and tenant_id
      const profile = await getCurrentUserProfile(session.user.id);

      console.log("Setting user:", profile);
      setUser({ ...session.user, ...profile });
    } catch (error) {
      console.error("Error fetching user:", error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchUser();

    // Listen for auth changes
    if (supabase) {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          fetchUser();
        } else {
          setUser(null);
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [supabase, fetchUser]);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      router.push("/auth");
    } catch (error) {
      console.error("Error signing out:", error);
      throw error;
    }
  };

  const refreshUser = async () => {
    await fetchUser();
  };

  return (
    <UserContext.Provider value={{ user, isLoading, signOut, refreshUser }}>
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
  return user?.role || null;
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

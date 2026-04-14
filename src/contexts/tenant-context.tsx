"use client";

import { createContext, useContext } from "react";
import { useAsync, UseAsyncReturn } from "@/hooks/useAsync";
import { CaseStatementJoin, ProfileWithEmail } from "@/types";
import { useUser } from "./user-context";
import { apiFetch } from "@/lib/api-utils";
import { getCases } from "@/lib/supabase/queries";

type TeamState = {
  members: ProfileWithEmail[];
  nameMap: Record<string, string>;
};
type CasesState = CaseStatementJoin[];

const TEAM_INITIAL_STATE: TeamState = { members: [], nameMap: {} };

interface TenantContextValue {
  team: UseAsyncReturn<TeamState, TeamState, TeamState>;
  cases: UseAsyncReturn<CasesState, CasesState, CasesState>;
}

const TenantContext = createContext<TenantContextValue | null>(null);

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useUser();

  const team = useAsync<TeamState, TeamState, TeamState>(
    async () => {
      if (!user?.tenant_id) return TEAM_INITIAL_STATE;
      const { members } = await apiFetch<{ members: ProfileWithEmail[] }>(
        "/api/tenant/members",
      );

      const nameMap = Object.fromEntries(
        members.map((member) => [
          member.user_id,
          member.display_name || member.email || "Team member",
        ]),
      );
      return { members, nameMap };
    },
    [user?.tenant_id],
    {
      initialState: TEAM_INITIAL_STATE,
      onError: () => TEAM_INITIAL_STATE,
      enabled: !!user?.tenant_id,
    },
  );

  const cases = useAsync<CasesState, CasesState, CasesState>(
    async () => {
      if (!user || !user?.tenant_id) return [];
      const cases = await getCases();
      return cases;
    },
    [user],
    {
      initialState: [],
      onError: () => [],
      enabled: !!user?.tenant_id,
    },
  );

  return (
    <TenantContext.Provider value={{ team, cases }}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = (): TenantContextValue => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return context;
};

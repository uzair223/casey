import { getServiceClient } from "../server";
import { getSupabaseClient } from "../client";
import { assertServerOnly } from "@/lib/utils";
import type { Invite } from "@/lib/types";

export type PlatformStats = {
  tenants: number;
  cases: number;
  statements: number;
  users: number;
  pendingInvites: number;
  casesByStatus: Record<string, number>;
  recentActivity: {
    cases: number;
    statements: number;
  };
};

export type TenantWithCounts = {
  id: string;
  name: string;
  createdAt: string;
  userCount: number;
  statementCount: number;
};

export type TenantStats = {
  cases: number;
  statements: number;
  teamMembers: number;
  pendingInvites: number;
  casesByStatus: Record<string, number>;
  recentActivity: {
    cases: number;
    statements: number;
  };
};

export type AppAdminMember = {
  user_id: string;
  display_name: string | null;
  created_at: string;
};

/**
 * Get tenant by ID
 * Server-callable: Used for looking up tenant information
 */
export const getTenantById = async (
  tenant_id: string,
): Promise<{ id: string; name: string } | null> => {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("tenants")
    .select("id, name")
    .eq("id", tenant_id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};

/**
 * Get platform-wide statistics
 * Client-callable: RLS filters to app_admin only
 */
export const getPlatformStats = async (): Promise<PlatformStats> => {
  const supabase = getSupabaseClient();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [
    { count: tenantCount },
    { count: caseCount },
    { count: statementCount },
    { count: userCount },
    { count: pendingInvitesCount },
    { data: casesByStatusData },
    { count: recentCases },
    { count: recentStatements },
  ] = await Promise.all([
    supabase.from("tenants").select("*", { count: "exact", head: true }),
    supabase.from("statements").select("*", { count: "exact", head: true }),
    supabase.from("statements").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase
      .from("invites")
      .select("*", { count: "exact", head: true })
      .is("tenant_id", null)
      .eq("role", "tenant_admin")
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString()),
    supabase.from("statements").select("status"),
    supabase
      .from("statements")
      .select("*", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo.toISOString()),
    supabase
      .from("statements")
      .select("*", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo.toISOString()),
  ]);

  const statusCounts =
    casesByStatusData?.reduce(
      (acc, c) => {
        acc[c.status] = (acc[c.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    ) || {};

  return {
    tenants: tenantCount || 0,
    cases: caseCount || 0,
    statements: statementCount || 0,
    users: userCount || 0,
    pendingInvites: pendingInvitesCount || 0,
    casesByStatus: statusCounts,
    recentActivity: {
      cases: recentCases || 0,
      statements: recentStatements || 0,
    },
  };
};

/**
 * Get all app tenants with their stats
 * Client-callable: RLS filters to app_admin only
 */
export const getTenantsWithCounts = async (): Promise<TenantWithCounts[]> => {
  const supabase = getSupabaseClient();

  const { data: tenants, error: tenantsError } = await supabase
    .from("tenants")
    .select("*")
    .order("created_at", { ascending: false });

  if (tenantsError) {
    throw tenantsError;
  }

  const tenantsWithCounts = await Promise.all(
    (tenants || []).map(async (tenant) => {
      const [{ count: userCount }, { count: statementCount }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("*", { count: "exact", head: true })
            .eq("tenant_id", tenant.id),
          supabase
            .from("statements")
            .select("*", { count: "exact", head: true })
            .eq("tenant_id", tenant.id),
        ]);

      return {
        id: tenant.id,
        name: tenant.name,
        createdAt: tenant.created_at,
        userCount: userCount || 0,
        statementCount: statementCount || 0,
      };
    }),
  );

  return tenantsWithCounts;
};

/**
 * Get all tenant signup invites (tenant_id = NULL, role = tenant_admin)
 * Client-callable: RLS filters to app_admin only
 */
export const getTenantSignupInvites = async (): Promise<Invite[]> => {
  const supabase = getSupabaseClient();

  const { data: invites, error } = await supabase
    .from("invites")
    .select("*")
    .is("tenant_id", null)
    .eq("role", "tenant_admin")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return invites || [];
};

/**
 * Get all app admin invites (tenant_id = NULL, role = app_admin)
 * Client-callable: RLS filters to app_admin only
 */
export const getAppAdminInvites = async (): Promise<Invite[]> => {
  const supabase = getSupabaseClient();

  const { data: invites, error } = await supabase
    .from("invites")
    .select("*")
    .is("tenant_id", null)
    .eq("role", "app_admin")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return invites || [];
};

/**
 * Get existing app admin members
 * Client-callable: RLS filters to app_admin only
 */
export const getAppAdminMembers = async (): Promise<AppAdminMember[]> => {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, display_name, created_at")
    .eq("role", "app_admin")
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data || [];
};

/**
 * Get statistics for a tenant
 * Client-callable: RLS filters data to current user's tenant
 */
export const getTenantStats = async (
  tenant_id: string,
): Promise<TenantStats> => {
  const supabase = getSupabaseClient();
  // Count cases
  const { count: casesCount } = await supabase
    .from("statements")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenant_id);

  // Count statements
  const { count: statementsCount } = await supabase
    .from("statements")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenant_id);

  // Count team members
  const { count: teamCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenant_id);

  // Count pending invites
  const { count: invitesCount } = await supabase
    .from("invites")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenant_id)
    .is("accepted_at", null);

  // Get cases by status
  const { data: allCases } = await supabase
    .from("statements")
    .select("status")
    .eq("tenant_id", tenant_id);

  const casesByStatus: Record<string, number> = {};
  if (allCases) {
    for (const caseItem of allCases) {
      casesByStatus[caseItem.status] =
        (casesByStatus[caseItem.status] || 0) + 1;
    }
  }

  // Get recent activity (cases and statements created in last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { count: recentCases } = await supabase
    .from("statements")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenant_id)
    .gte("created_at", sevenDaysAgo.toISOString());

  const { count: recentStatements } = await supabase
    .from("statements")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenant_id)
    .gte("created_at", sevenDaysAgo.toISOString());

  return {
    cases: casesCount || 0,
    statements: statementsCount || 0,
    teamMembers: teamCount || 0,
    pendingInvites: invitesCount || 0,
    casesByStatus,
    recentActivity: {
      cases: recentCases || 0,
      statements: recentStatements || 0,
    },
  };
};

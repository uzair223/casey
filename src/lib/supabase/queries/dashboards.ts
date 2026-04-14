import { getSupabaseClient } from "../client";
import {
  buildPlatformDashboardMetrics,
  buildPlatformDashboardTrendMetrics,
} from "@/lib/dashboard/metrics";
import type {
  AppAdminMember,
  Invite,
  Database,
  PlatformStats,
  TenantStats,
  TenantWithCounts,
  WaitlistSignupEntry,
} from "@/types";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

type Tables = Database["public"]["Tables"];
type TableName = keyof Tables;

type CountResult = {
  count: number | null;
  error: PostgrestError | null;
};

export async function exactCount<T extends TableName>(
  supabase: SupabaseClient<Database>,
  table: T,
  query?: (
    qb: ReturnType<SupabaseClient<Database>["from"]>,
  ) => PromiseLike<CountResult>,
): Promise<number> {
  const base = supabase.from(table).select("*", { count: "exact", head: true });

  const { count, error } = await (query?.(base) ?? base);

  if (error) throw error;
  return count ?? 0;
}

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
    tenantCount,
    caseCount,
    statementCount,
    userCount,
    pendingInvitesCount,
    { data: casesByStatus },
    recentCases,
    recentStatements,
  ] = await Promise.all([
    exactCount(supabase, "tenants"),
    exactCount(supabase, "cases"),
    exactCount(supabase, "statements"),
    exactCount(supabase, "profiles"),
    exactCount(supabase, "invites", (qb) =>
      qb
        .is("tenant_id", null)
        .eq("role", "tenant_admin")
        .is("accepted_at", null)
        .gt("expires_at", new Date().toISOString()),
    ),
    supabase.from("cases").select("status"),
    exactCount(supabase, "cases", (qb) =>
      qb.gte("created_at", sevenDaysAgo.toISOString()),
    ),
    exactCount(supabase, "statements", (qb) =>
      qb.gte("created_at", sevenDaysAgo.toISOString()),
    ),
  ]);

  const statusCounts =
    casesByStatus?.reduce(
      (acc, c) => {
        acc[c.status] = (acc[c.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    ) || {};

  return {
    tenants: tenantCount,
    cases: caseCount,
    statements: statementCount,
    users: userCount,
    pendingInvites: pendingInvitesCount,
    casesByStatus: statusCounts,
    recentActivity: {
      cases: recentCases,
      statements: recentStatements,
    },
  };
};

export const getPlatformDashboardData = async () => {
  const supabase = getSupabaseClient();
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);
  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(now.getDate() - 14);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);
  const sixtyDaysAgo = new Date(now);
  sixtyDaysAgo.setDate(now.getDate() - 60);

  const [
    stats,
    { count: cases7dCurrent },
    { count: cases7dPrevious },
    { count: statements7dCurrent },
    { count: statements7dPrevious },
    { count: users30dCurrent },
    { count: users30dPrevious },
    { count: tenants30dCurrent },
    { count: tenants30dPrevious },
    { count: pendingInvites30dCurrent },
    { count: pendingInvites30dPrevious },
  ] = await Promise.all([
    getPlatformStats(),
    supabase
      .from("cases")
      .select("*", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo.toISOString())
      .lt("created_at", now.toISOString()),
    supabase
      .from("cases")
      .select("*", { count: "exact", head: true })
      .gte("created_at", fourteenDaysAgo.toISOString())
      .lt("created_at", sevenDaysAgo.toISOString()),
    supabase
      .from("statements")
      .select("*", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo.toISOString())
      .lt("created_at", now.toISOString()),
    supabase
      .from("statements")
      .select("*", { count: "exact", head: true })
      .gte("created_at", fourteenDaysAgo.toISOString())
      .lt("created_at", sevenDaysAgo.toISOString()),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gte("created_at", thirtyDaysAgo.toISOString())
      .lt("created_at", now.toISOString()),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gte("created_at", sixtyDaysAgo.toISOString())
      .lt("created_at", thirtyDaysAgo.toISOString()),
    supabase
      .from("tenants")
      .select("*", { count: "exact", head: true })
      .gte("created_at", thirtyDaysAgo.toISOString())
      .lt("created_at", now.toISOString()),
    supabase
      .from("tenants")
      .select("*", { count: "exact", head: true })
      .gte("created_at", sixtyDaysAgo.toISOString())
      .lt("created_at", thirtyDaysAgo.toISOString()),
    supabase
      .from("invites")
      .select("*", { count: "exact", head: true })
      .is("tenant_id", null)
      .eq("role", "tenant_admin")
      .is("accepted_at", null)
      .gt("expires_at", now.toISOString())
      .gte("created_at", thirtyDaysAgo.toISOString())
      .lt("created_at", now.toISOString()),
    supabase
      .from("invites")
      .select("*", { count: "exact", head: true })
      .is("tenant_id", null)
      .eq("role", "tenant_admin")
      .is("accepted_at", null)
      .gt("expires_at", now.toISOString())
      .gte("created_at", sixtyDaysAgo.toISOString())
      .lt("created_at", thirtyDaysAgo.toISOString()),
  ]);

  return {
    stats,
    kpis: buildPlatformDashboardMetrics(stats),
    trends: buildPlatformDashboardTrendMetrics({
      cases7dCurrent: cases7dCurrent ?? 0,
      cases7dPrevious: cases7dPrevious ?? 0,
      statements7dCurrent: statements7dCurrent ?? 0,
      statements7dPrevious: statements7dPrevious ?? 0,
      users30dCurrent: users30dCurrent ?? 0,
      users30dPrevious: users30dPrevious ?? 0,
      tenants30dCurrent: tenants30dCurrent ?? 0,
      tenants30dPrevious: tenants30dPrevious ?? 0,
      pendingInvites30dCurrent: pendingInvites30dCurrent ?? 0,
      pendingInvites30dPrevious: pendingInvites30dPrevious ?? 0,
    }),
  };
};

/**
 * Get tenant-wide dashboard statistics
 * RLS will limit data
 */
export const getTenantUserDashboardStats = async (): Promise<TenantStats> => {
  const supabase = getSupabaseClient();
  const [casesCount, statementsCount, teamCount, invitesCount] =
    await Promise.all([
      exactCount(supabase, "cases"),
      exactCount(supabase, "statements"),
      exactCount(supabase, "profiles"),
      exactCount(supabase, "invites", (qb) => qb.is("accepted_at", null)),
    ]);

  const { data: allCases } = await supabase.from("cases").select("status");
  const casesByStatus: Record<string, number> = {};
  if (allCases) {
    for (const caseItem of allCases) {
      casesByStatus[caseItem.status] =
        (casesByStatus[caseItem.status] || 0) + 1;
    }
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [recentCases, recentStatements] = await Promise.all([
    exactCount(supabase, "cases", (qb) =>
      qb.gte("created_at", sevenDaysAgo.toISOString()),
    ),
    exactCount(supabase, "statements", (qb) =>
      qb.gte("created_at", sevenDaysAgo.toISOString()),
    ),
  ]);

  return {
    cases: casesCount,
    statements: statementsCount,
    teamMembers: teamCount,
    pendingInvites: invitesCount,
    casesByStatus,
    recentActivity: {
      cases: recentCases,
      statements: recentStatements,
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
 * Get all waitlist signups
 * Client-callable: RLS filters to app_admin only
 */
export const getWaitlistSignups = async (): Promise<WaitlistSignupEntry[]> => {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("waitlist_signups")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
};

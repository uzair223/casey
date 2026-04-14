import type { Invite, Profile, WaitlistSignup } from "./common";
import type {
  PlatformDashboardMetrics,
  PlatformDashboardTrendMetrics,
} from "@/lib/dashboard/metrics";

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

export type WaitlistSignupEntry = WaitlistSignup;

export type ProfileWithEmail = Profile & {
  email: string | null;
};

export type InviteWithTenantName = Invite & {
  tenant_name: string | null;
};

export type InviteRow = {
  id: string;
  email: string | null;
  token: string;
  tenant_id: string | null;
  role: string;
  expires_at: string;
  accepted_at: string | null;
};

export type InviteReadProfile = {
  role?: string | null;
  tenant_id?: string | null;
} | null;

export type AppAdminDashboardData = {
  tenants: TenantWithCounts[];
  tenantInvites: Invite[];
  appAdminInvites: Invite[];
  appAdminMembers: AppAdminMember[];
  waitlistSignups: WaitlistSignupEntry[];
  stats: PlatformStats;
  kpis: PlatformDashboardMetrics;
  trends: PlatformDashboardTrendMetrics;
};

import "server-only";

import {
  FREE_LEAD_LIMIT,
  monthlyAcceptedLeadAllowance,
  normalizeTenantPlan,
} from "@/lib/billing/plans";
import { getServiceClient } from "@/lib/supabase/server";

export type LeadUsageSummary = {
  plan: "trial" | "starter" | "growth";
  billingStatus: string;
  mode: "free" | "monthly" | "needs_plan";
  used: number;
  limit: number;
  overageCredits: number;
  canPurchaseOverage: boolean;
  periodStart: string | null;
};

function monthStartIso() {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  ).toISOString();
}

export async function countAcceptedLeads(
  supabase: ReturnType<typeof getServiceClient>,
  tenantId: string,
  acceptedFrom?: string,
) {
  let query = supabase
    .from("statements")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("participant_kind", "primary")
    .not("accepted_at", "is", null);
  if (acceptedFrom) {
    query = query.gte("accepted_at", acceptedFrom);
  }
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function getLeadUsageForTenant(
  tenantId: string,
): Promise<LeadUsageSummary> {
  const supabase = getServiceClient("lead-usage");
  const { data: tenant, error } = await supabase
    .from("tenants")
    .select("plan, billing_status, overage_credits, billing_period_start")
    .eq("id", tenantId)
    .maybeSingle();
  if (error || !tenant) {
    throw error ?? new Error("Tenant not found");
  }

  const plan = normalizeTenantPlan(tenant.plan);
  const lifetime = await countAcceptedLeads(supabase, tenantId);
  const onActivePlan =
    tenant.billing_status === "active" &&
    (plan === "starter" || plan === "growth");
  const periodStart = tenant.billing_period_start ?? monthStartIso();

  if (onActivePlan) {
    const used = await countAcceptedLeads(supabase, tenantId, periodStart);
    const limit = monthlyAcceptedLeadAllowance(plan);
    return {
      plan,
      billingStatus: tenant.billing_status,
      mode: "monthly",
      used,
      limit,
      overageCredits: tenant.overage_credits,
      canPurchaseOverage: true,
      periodStart,
    };
  }

  if (lifetime < FREE_LEAD_LIMIT) {
    return {
      plan,
      billingStatus: tenant.billing_status,
      mode: "free",
      used: lifetime,
      limit: FREE_LEAD_LIMIT,
      overageCredits: tenant.overage_credits,
      canPurchaseOverage: false,
      periodStart: null,
    };
  }

  return {
    plan,
    billingStatus: tenant.billing_status,
    mode: "needs_plan",
    used: FREE_LEAD_LIMIT,
    limit: FREE_LEAD_LIMIT,
    overageCredits: tenant.overage_credits,
    canPurchaseOverage: false,
    periodStart: null,
  };
}

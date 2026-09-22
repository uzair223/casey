import "server-only";

import { userError } from "@/lib/api-utils";
import { createCase } from "@/lib/supabase/mutations/case";
import { getServiceClient } from "@/lib/supabase/server";
import {
  FREE_CASE_LIMIT,
  isTenantPlan,
  monthlyCaseAllowance,
  type CaseGate,
} from "@/lib/billing/plans";

type OpenCasePayload = {
  title?: string;
  assigned_to_ids?: string[];
  status?: string;
  case_template_id?: string | null;
  case_metadata?: Record<string, string | number | null | undefined>;
};

export type OpenCaseResult =
  | { ok: true; id: string }
  | { ok: false; gate: CaseGate; error: string };

function monthStartIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

async function countCases(
  supabase: ReturnType<typeof getServiceClient>,
  tenantId: string,
  createdFrom?: string,
) {
  let query = supabase
    .from("cases")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  if (createdFrom) {
    query = query.gte("created_at", createdFrom);
  }
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

async function consumeOverageCredit(
  supabase: ReturnType<typeof getServiceClient>,
  tenantId: string,
  credits: number,
) {
  if (credits < 1) return false;
  const { data, error } = await supabase
    .from("tenants")
    .update({ overage_credits: credits - 1 })
    .eq("id", tenantId)
    .eq("overage_credits", credits)
    .select("id");
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export async function openTenantCase(
  tenantId: string,
  payload: OpenCasePayload,
): Promise<OpenCaseResult> {
  const supabase = getServiceClient("open-tenant-case");
  const { data: tenant, error } = await supabase
    .from("tenants")
    .select(
      "plan, billing_status, seat_limit, overage_credits, billing_period_start, soft_deleted_at",
    )
    .eq("id", tenantId)
    .maybeSingle();

  if (error || !tenant) {
    throw error ?? new Error("Tenant not found");
  }

  if (tenant.soft_deleted_at) {
    throw userError("This organisation is archived.", 409);
  }

  const plan = isTenantPlan(tenant.plan) ? tenant.plan : "trial";
  const lifetime = await countCases(supabase, tenantId);
  let consumedCredits: number | null = null;

  if (lifetime >= FREE_CASE_LIMIT) {
    const onActivePlan =
      tenant.billing_status === "active" &&
      (plan === "practice" || plan === "firm");
    const periodStart = tenant.billing_period_start ?? monthStartIso();
    const usedThisPeriod = onActivePlan
      ? await countCases(supabase, tenantId, periodStart)
      : 0;
    const allowance = onActivePlan
      ? monthlyCaseAllowance(plan, tenant.seat_limit)
      : 0;
    const withinAllowance = onActivePlan && usedThisPeriod < allowance;

    if (!withinAllowance) {
      const consumed = await consumeOverageCredit(
        supabase,
        tenantId,
        tenant.overage_credits,
      );
      if (!consumed) {
        if (onActivePlan) {
          return {
            ok: false,
            gate: "extra_case",
            error: "This month's cases are used.",
          };
        }
        return {
          ok: false,
          gate: plan === "firm" ? "firm" : "practice",
          error: "Choose a plan to open another case.",
        };
      }
      consumedCredits = tenant.overage_credits;
    }
  }

  try {
    const created = await createCase(
      {
        tenant_id: tenantId,
        title: payload.title,
        assigned_to_ids: payload.assigned_to_ids,
        status: payload.status,
        case_template_id: payload.case_template_id,
        case_metadata: payload.case_metadata,
      },
      supabase,
    );
    return { ok: true, id: created.id };
  } catch (createError) {
    if (consumedCredits != null) {
      await supabase
        .from("tenants")
        .update({ overage_credits: consumedCredits })
        .eq("id", tenantId)
        .eq("overage_credits", consumedCredits - 1);
    }
    throw createError;
  }
}

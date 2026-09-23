import "server-only";

import { userError } from "@/lib/api-utils";
import { createCase } from "@/lib/supabase/mutations/case";
import { getServiceClient } from "@/lib/supabase/server";
import {
  FREE_CASE_LIMIT,
  monthlyAcceptedLeadAllowance,
  normalizeTenantPlan,
  type CaseGate,
} from "@/lib/billing/plans";

type OpenCasePayload = {
  title?: string;
  assigned_to_ids?: string[];
  status?: string;
  case_template_id?: string | null;
  case_metadata?: Record<string, string | number | null | undefined>;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  lead_stage?: string;
  role_key?: string;
  accepted?: boolean;
};

export type OpenCaseResult =
  | { ok: true; id: string }
  | { ok: false; gate: CaseGate; error: string };

function monthStartIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

async function countAcceptedLeads(
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

export async function reserveAcceptedLeadSlot(tenantId: string): Promise<
  | { ok: true; consumedCredits: number | null }
  | { ok: false; gate: CaseGate; error: string }
> {
  const supabase = getServiceClient("reserve-accepted-lead");
  const { data: tenant, error } = await supabase
    .from("tenants")
    .select(
      "plan, billing_status, overage_credits, billing_period_start, soft_deleted_at",
    )
    .eq("id", tenantId)
    .maybeSingle();
  if (error || !tenant) throw error ?? new Error("Tenant not found");
  if (tenant.soft_deleted_at) {
    throw userError("This organisation is archived.", 409);
  }

  const plan = normalizeTenantPlan(tenant.plan);
  const lifetime = await countAcceptedLeads(supabase, tenantId);
  if (lifetime < FREE_CASE_LIMIT) {
    return { ok: true, consumedCredits: null };
  }

  const onActivePlan =
    tenant.billing_status === "active" &&
    (plan === "starter" || plan === "growth");
  const periodStart = tenant.billing_period_start ?? monthStartIso();
  const usedThisPeriod = onActivePlan
    ? await countAcceptedLeads(supabase, tenantId, periodStart)
    : 0;
  const allowance = onActivePlan ? monthlyAcceptedLeadAllowance(plan) : 0;
  if (onActivePlan && usedThisPeriod < allowance) {
    return { ok: true, consumedCredits: null };
  }

  const consumed = await consumeOverageCredit(
    supabase,
    tenantId,
    tenant.overage_credits,
  );
  if (consumed) {
    return { ok: true, consumedCredits: tenant.overage_credits };
  }
  if (onActivePlan) {
    return {
      ok: false,
      gate: "extra_lead",
      error: "This month's accepted leads are used.",
    };
  }
  return {
    ok: false,
    gate: plan === "growth" ? "growth" : "starter",
    error: "Choose a plan to accept another lead.",
  };
}

export async function openTenantCase(
  tenantId: string,
  payload: OpenCasePayload,
  options?: { bill?: boolean },
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

  const bill = options?.bill !== false;
  const reserved = bill
    ? await reserveAcceptedLeadSlot(tenantId)
    : { ok: true as const, consumedCredits: null };
  if (!reserved.ok) return reserved;
  const consumedCredits = reserved.consumedCredits;

  try {
    const created = await createCase(
      {
        tenant_id: tenantId,
        title: payload.title,
        assigned_to_ids: payload.assigned_to_ids,
        status: payload.status,
        case_template_id: payload.case_template_id,
        case_metadata: payload.case_metadata,
        contact_name: payload.contact_name,
        contact_email: payload.contact_email,
        contact_phone: payload.contact_phone,
        lead_stage: payload.lead_stage,
        role_key: payload.role_key,
        accepted: payload.accepted,
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

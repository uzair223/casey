import { getServiceClient } from "@/lib/supabase/server";
import { isTenantPlan, seatCapForPlan } from "@/lib/billing/plans";

export async function getTenantSeatUsage(tenantId: string) {
  const supabase = getServiceClient("tenant-seat-usage");

  const [{ count: memberCount }, { count: pendingInviteCount }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .is("soft_deleted_at", null),
      supabase
        .from("invites")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .is("accepted_at", null)
        .gt("expires_at", new Date().toISOString()),
    ]);

  return (memberCount ?? 0) + (pendingInviteCount ?? 0);
}

export async function assertTenantHasSeat(params: {
  tenantId: string | null;
  isAppAdmin: boolean;
}) {
  if (!params.tenantId) {
    return;
  }

  const supabase = getServiceClient("assert-tenant-seat");
  const { data: tenant, error } = await supabase
    .from("tenants")
    .select("seat_limit, billing_status, plan")
    .eq("id", params.tenantId)
    .maybeSingle();

  if (error || !tenant) {
    throw error ?? new Error("Tenant not found");
  }

  if (
    tenant.billing_status === "past_due" ||
    tenant.billing_status === "canceled"
  ) {
    const blocked = new Error(
      "Billing needs to be current before adding another person.",
    );
    (blocked as Error & { status?: number }).status = 409;
    throw blocked;
  }

  const plan = isTenantPlan(tenant.plan) ? tenant.plan : "trial";
  const limit = seatCapForPlan(plan);
  if (limit == null) return;
  const used = await getTenantSeatUsage(params.tenantId);
  if (used >= limit) {
    const message = `This plan includes ${limit} seats.`;
    const seatError = new Error(message);
    (seatError as Error & { status?: number }).status = 409;
    throw seatError;
  }
}

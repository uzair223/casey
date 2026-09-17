import { getServiceClient } from "@/lib/supabase/server";

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
    .select("seat_limit, billing_status")
    .eq("id", params.tenantId)
    .maybeSingle();

  if (error || !tenant) {
    throw error ?? new Error("Tenant not found");
  }

  const used = await getTenantSeatUsage(params.tenantId);
  if (used >= tenant.seat_limit) {
    const error = new Error(
      `Seat limit reached (${tenant.seat_limit}). Increase seats before inviting another member.`,
    );
    (error as Error & { status?: number }).status = 409;
    throw error;
  }
}

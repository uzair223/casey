import { ok, requireTenantAdmin, serverError } from "@/lib/api-utils";
import { getServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const auth = await requireTenantAdmin(request);
    const supabase = getServiceClient("tenant-dpa");
    const { data: tenant, error } = await supabase
      .from("tenants")
      .select("dpa_signed_at")
      .eq("id", auth.tenantId)
      .maybeSingle();
    if (error || !tenant) {
      throw error ?? new Error("Tenant not found");
    }

    const dpaSignedAt = tenant.dpa_signed_at ?? new Date().toISOString();
    if (!tenant.dpa_signed_at) {
      const { error: updateError } = await supabase
        .from("tenants")
        .update({ dpa_signed_at: dpaSignedAt })
        .eq("id", auth.tenantId);
      if (updateError) throw updateError;
    }

    return ok({ dpaSignedAt });
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError(error);
  }
}

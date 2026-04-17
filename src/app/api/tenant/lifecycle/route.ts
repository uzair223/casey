import { getServiceClient } from "@/lib/supabase/server";
import { SERVERONLY_getUserProfile } from "@/lib/supabase/queries";
import {
  forbidden,
  gone,
  ok,
  notFound,
  serverError,
  unauthorized,
} from "@/lib/api-utils";

const getBearerToken = (request: Request) => {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
};

const requireTenantUser = async (request: Request) => {
  const token = getBearerToken(request);
  if (!token) {
    return {
      error: unauthorized(),
    };
  }

  const supabase = getServiceClient();
  const { data: userData, error: userError } =
    await supabase.auth.getUser(token);

  if (userError || !userData.user) {
    return {
      error: unauthorized(),
    };
  }

  const profile = await SERVERONLY_getUserProfile(userData.user.id);

  if (!profile || !profile.tenant_id) {
    return {
      error: forbidden("No tenant associated"),
    };
  }

  return {
    role: profile.role,
    tenantId: profile.tenant_id,
  };
};

export async function GET(request: Request) {
  const auth = await requireTenantUser(request);
  if (auth.error) return auth.error;

  try {
    const supabase = getServiceClient();

    const { data, error } = await supabase
      .from("tenants")
      .select("id, name, soft_deleted_at, purge_after")
      .eq("id", auth.tenantId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return ok({ exists: false, softDeleted: false });
    }

    const nowMs = Date.now();
    const purgeAfterMs = data.purge_after ? Date.parse(data.purge_after) : null;
    const canRestore =
      auth.role === "tenant_admin" &&
      !!data.soft_deleted_at &&
      (!purgeAfterMs || purgeAfterMs > nowMs);

    return ok({
      exists: true,
      name: data.name,
      softDeleted: !!data.soft_deleted_at,
      softDeletedAt: data.soft_deleted_at,
      purgeAfter: data.purge_after,
      canRestore,
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: Request) {
  const auth = await requireTenantUser(request);
  if (auth.error) return auth.error;

  if (auth.role !== "tenant_admin") {
    return forbidden();
  }

  try {
    const supabase = getServiceClient();

    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id, soft_deleted_at, purge_after")
      .eq("id", auth.tenantId)
      .maybeSingle();

    if (tenantError || !tenant) {
      return notFound("Tenant not found");
    }

    if (!tenant.soft_deleted_at) {
      return ok({ ok: true, alreadyActive: true });
    }

    const nowMs = Date.now();
    const purgeAfterMs = tenant.purge_after
      ? Date.parse(tenant.purge_after)
      : null;

    if (purgeAfterMs && purgeAfterMs <= nowMs) {
      return gone("Tenant can no longer be restored");
    }

    await supabase.rpc("restore_tenant", { tenant_id_param: auth.tenantId });

    return ok({ ok: true });
  } catch (error) {
    return serverError(error);
  }
}

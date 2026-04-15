import { getServiceClient } from "@/lib/supabase/server";
import { SERVERONLY_getUserProfile } from "@/lib/supabase/queries";
import { logAuditEvent } from "@/lib/observability/audit";
import {
  forbidden,
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

const requireUser = async (request: Request) => {
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

  if (!profile) {
    return {
      error: notFound("Profile not found"),
    };
  }

  return {
    userId: userData.user.id,
    email: userData.user.email ?? null,
    profile,
  };
};

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;

  try {
    const supabase = getServiceClient();
    const url = new URL(request.url);
    const scope =
      url.searchParams.get("scope") === "tenant" ? "tenant" : "user";
    const tenantId = auth.profile.tenant_id;

    const canTenantExport =
      scope === "tenant" &&
      (auth.profile.role === "tenant_admin" ||
        auth.profile.role === "app_admin") &&
      !!auth.profile.tenant_id;

    if (scope === "tenant" && !canTenantExport) {
      return forbidden();
    }

    const profileExport = {
      userId: auth.userId,
      email: auth.email,
      role: auth.profile.role,
      tenantId: auth.profile.tenant_id,
      tenantName: auth.profile.tenant_name,
      displayName: auth.profile.display_name,
      exportedAt: new Date().toISOString(),
      scope,
    };

    const auditLogs =
      scope === "tenant"
        ? ((
            await supabase
              .from("audit_logs")
              .select("*")
              .eq("tenant_id", tenantId as string)
              .order("created_at", { ascending: false })
              .limit(5000)
          ).data ?? [])
        : ((
            await supabase
              .from("audit_logs")
              .select("*")
              .eq("actor_user_id", auth.userId)
              .order("created_at", { ascending: false })
              .limit(2000)
          ).data ?? []);

    const deletionRequests =
      scope === "tenant"
        ? ((
            await supabase
              .from("account_deletion_requests")
              .select("*")
              .eq("tenant_id", tenantId as string)
              .order("created_at", { ascending: false })
          ).data ?? [])
        : ((
            await supabase
              .from("account_deletion_requests")
              .select("*")
              .eq("requested_user_id", auth.userId)
              .order("created_at", { ascending: false })
          ).data ?? []);

    const invites =
      scope === "tenant"
        ? ((
            await supabase
              .from("invites")
              .select("*")
              .eq("tenant_id", tenantId as string)
              .order("created_at", { ascending: false })
          ).data ?? [])
        : ((
            await supabase
              .from("invites")
              .select("*")
              .eq("created_by", auth.userId)
              .order("created_at", { ascending: false })
          ).data ?? []);

    const cases =
      scope === "tenant"
        ? ((
            await supabase
              .from("cases")
              .select("*")
              .eq("tenant_id", tenantId as string)
              .order("created_at", { ascending: false })
          ).data ?? [])
        : ((
            await supabase
              .from("cases")
              .select("*")
              .contains("assigned_to_ids", [auth.userId])
              .order("created_at", { ascending: false })
          ).data ?? []);

    const witnessStatements =
      scope === "tenant"
        ? ((
            await supabase
              .from("statements")
              .select("*")
              .eq("tenant_id", tenantId as string)
              .order("created_at", { ascending: false })
          ).data ?? [])
        : ((
            await supabase
              .from("statements")
              .select("*")
              .contains("assigned_to_ids", [auth.userId])
              .order("created_at", { ascending: false })
          ).data ?? []);

    const payload = {
      profile: profileExport,
      auditLogs,
      deletionRequests,
      invites,
      cases,
      witnessStatements,
    };

    await logAuditEvent({
      tenantId: auth.profile.tenant_id,
      actorUserId: auth.userId,
      action: "dsar.export.generated",
      targetType: scope,
      targetId: auth.userId,
      metadata: {
        scope,
      },
    });

    const filename = `dsar-${scope}-${auth.userId}-${Date.now()}.json`;

    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename=\"${filename}\"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return serverError(error);
  }
}

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

async function listBy<T>(
  query: PromiseLike<{ data: T[] | null; error: unknown }>,
) {
  const result = await query;
  return result.data ?? [];
}

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
        ? await listBy(
            supabase
              .from("audit_logs")
              .select("*")
              .eq("tenant_id", tenantId as string)
              .order("created_at", { ascending: false })
              .limit(5000),
          )
        : await listBy(
            supabase
              .from("audit_logs")
              .select("*")
              .eq("actor_user_id", auth.userId)
              .order("created_at", { ascending: false })
              .limit(2000),
          );

    const deletionRequests =
      scope === "tenant"
        ? await listBy(
            supabase
              .from("account_deletion_requests")
              .select("*")
              .eq("tenant_id", tenantId as string)
              .order("created_at", { ascending: false }),
          )
        : await listBy(
            supabase
              .from("account_deletion_requests")
              .select("*")
              .eq("requested_user_id", auth.userId)
              .order("created_at", { ascending: false }),
          );

    const invites =
      scope === "tenant"
        ? await listBy(
            supabase
              .from("invites")
              .select("*")
              .eq("tenant_id", tenantId as string)
              .order("created_at", { ascending: false }),
          )
        : await listBy(
            supabase
              .from("invites")
              .select("*")
              .eq("created_by", auth.userId)
              .order("created_at", { ascending: false }),
          );

    const cases =
      scope === "tenant"
        ? await listBy(
            supabase
              .from("cases")
              .select("*")
              .eq("tenant_id", tenantId as string)
              .order("created_at", { ascending: false }),
          )
        : await listBy(
            supabase
              .from("cases")
              .select("*")
              .contains("assigned_to_ids", [auth.userId])
              .order("created_at", { ascending: false }),
          );

    const witnessStatements =
      scope === "tenant"
        ? await listBy(
            supabase
              .from("statements")
              .select("*")
              .eq("tenant_id", tenantId as string)
              .order("created_at", { ascending: false }),
          )
        : await listBy(
            supabase
              .from("statements")
              .select("*")
              .contains("assigned_to_ids", [auth.userId])
              .order("created_at", { ascending: false }),
          );

    const statementIds = witnessStatements.map(
      (statement) => (statement as { id: string }).id,
    );

    const conversationMessages = statementIds.length
      ? await listBy(
          supabase
            .from("conversation_messages")
            .select("id, statement_id, role, content, created_at, meta")
            .in("statement_id", statementIds)
            .order("created_at", { ascending: false })
            .limit(5000),
        )
      : [];

    const supportingDocuments =
      scope === "tenant" && tenantId
        ? await listBy(
            supabase
              .from("statement_supporting_documents")
              .select(
                "id, statement_id, title, document, created_at, uploaded_by_type",
              )
              .eq("tenant_id", tenantId)
              .order("created_at", { ascending: false }),
          )
        : statementIds.length
          ? await listBy(
              supabase
                .from("statement_supporting_documents")
                .select(
                  "id, statement_id, title, document, created_at, uploaded_by_type",
                )
                .in("statement_id", statementIds)
                .order("created_at", { ascending: false }),
            )
          : [];

    const signatureEvents =
      scope === "tenant" && tenantId
        ? await listBy(
            supabase
              .from("statement_signature_events")
              .select("*")
              .eq("tenant_id", tenantId)
              .order("signed_at", { ascending: false }),
          )
        : statementIds.length
          ? await listBy(
              supabase
                .from("statement_signature_events")
                .select("*")
                .in("statement_id", statementIds)
                .order("signed_at", { ascending: false }),
            )
          : [];

    const storageObjects = [];
    if (scope === "tenant" && tenantId) {
      const { data } = await supabase.storage.from(tenantId).list("", {
        limit: 1000,
      });
      storageObjects.push(
        ...(data ?? []).map((object) => ({
          name: object.name,
          updatedAt: object.updated_at,
          downloadHint: `${envBaseUrl()}/storage/${tenantId}/${object.name}`,
        })),
      );
    }

    const payload = {
      profile: profileExport,
      auditLogs,
      deletionRequests,
      invites,
      cases,
      witnessStatements,
      conversationMessages,
      supportingDocuments,
      signatureEvents,
      storageObjects,
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

function envBaseUrl() {
  return process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
}

import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/server";
import { SERVERONLY_getUserProfile } from "@/lib/supabase/queries";
import { logAuditEvent } from "@/lib/audit";
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
  ok,
  serverError,
  unauthorized,
} from "@/lib/api-utils";

const ReviewRequestSchema = z.object({
  id: z.uuid(),
  action: z.enum(["approve", "reject"]),
});

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
    profile,
  };
};

export async function PATCH(request: Request) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;

  const canReview =
    auth.profile.role === "tenant_admin" || auth.profile.role === "app_admin";
  if (!canReview) {
    return forbidden();
  }

  try {
    const raw = await request.json();
    const parsed = ReviewRequestSchema.safeParse(raw);

    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Invalid payload");
    }

    const supabase = getServiceClient();

    const { data: deletionRequest, error: reqError } = await supabase
      .from("account_deletion_requests")
      .select("*")
      .eq("id", parsed.data.id)
      .maybeSingle();

    if (reqError || !deletionRequest) {
      return notFound("Request not found");
    }

    if (deletionRequest.status !== "pending") {
      return conflict("Request is no longer pending");
    }

    if (
      auth.profile.role === "tenant_admin" &&
      auth.profile.tenant_id !== deletionRequest.tenant_id
    ) {
      return forbidden();
    }

    if (parsed.data.action === "reject") {
      const { error } = await supabase
        .from("account_deletion_requests")
        .update({
          status: "rejected",
          reviewed_by_user_id: auth.userId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", parsed.data.id);

      if (error) {
        throw error;
      }

      await logAuditEvent({
        tenantId: deletionRequest.tenant_id,
        actorUserId: auth.userId,
        action: "account_deletion.rejected",
        targetType: "profile",
        targetId: deletionRequest.requested_user_id,
      });

      return ok({ ok: true, status: "rejected" });
    }

    const { data: targetProfile, error: targetProfileError } = await supabase
      .from("profiles")
      .select("role, tenant_id")
      .eq("user_id", deletionRequest.requested_user_id)
      .maybeSingle();

    if (targetProfileError || !targetProfile) {
      return notFound("Target profile not found");
    }

    if (targetProfile.role === "tenant_admin" && targetProfile.tenant_id) {
      const { count, error: countError } = await supabase
        .from("profiles")
        .select("user_id", { count: "exact", head: true })
        .eq("tenant_id", targetProfile.tenant_id)
        .eq("role", "tenant_admin");

      if (countError) {
        throw countError;
      }

      if ((count ?? 0) <= 1) {
        return conflict(
          "Cannot delete the final tenant admin in this organisation",
        );
      }
    }

    const { error: profileDeleteError } = await supabase
      .from("profiles")
      .delete()
      .eq("user_id", deletionRequest.requested_user_id);

    if (profileDeleteError) {
      throw profileDeleteError;
    }

    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(
      deletionRequest.requested_user_id,
    );

    if (authDeleteError) {
      throw authDeleteError;
    }

    const { error: reqUpdateError } = await supabase
      .from("account_deletion_requests")
      .update({
        status: "executed",
        reviewed_by_user_id: auth.userId,
        reviewed_at: new Date().toISOString(),
        executed_at: new Date().toISOString(),
      })
      .eq("id", parsed.data.id);

    if (reqUpdateError) {
      throw reqUpdateError;
    }

    await logAuditEvent({
      tenantId: deletionRequest.tenant_id,
      actorUserId: auth.userId,
      action: "account_deletion.executed",
      targetType: "profile",
      targetId: deletionRequest.requested_user_id,
      metadata: {
        requestId: parsed.data.id,
      },
    });

    return ok({ ok: true, status: "executed" });
  } catch (error) {
    return serverError(error);
  }
}

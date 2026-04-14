import { getServiceClient } from "@/lib/supabase/server";
import { SERVERONLY_getUserProfile } from "@/lib/supabase/queries";
import { logAuditEvent } from "@/lib/audit";
import {
  conflict,
  forbidden,
  ok,
  serverError,
  unauthorized,
} from "@/lib/api-utils";
import { getBearerToken } from "@/lib/api-utils";

export async function DELETE(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return unauthorized();
  }

  const supabase = getServiceClient("profileDelete");
  const { data: userData, error: userError } =
    await supabase.auth.getUser(token);

  if (userError || !userData.user) {
    return serverError(userError ?? new Error("Unauthorized"));
  }

  const auth = await SERVERONLY_getUserProfile(userData.user.id);

  if (!auth || (auth.role !== "tenant_admin" && auth.role !== "app_admin")) {
    return forbidden(
      "Direct deletion is not available for your role. Submit an account deletion request instead.",
    );
  }

  try {
    if (auth.role === "tenant_admin" && auth.tenant_id) {
      const { count, error: countError } = await supabase
        .from("profiles")
        .select("user_id", { count: "exact", head: true })
        .eq("tenant_id", auth.tenant_id)
        .eq("role", "tenant_admin");

      if (countError) {
        throw countError;
      }

      if ((count ?? 0) <= 1) {
        return conflict(
          "You are the last tenant admin. Assign another tenant admin or close the organisation first.",
        );
      }
    }

    const { error: profileDeleteError } = await supabase
      .from("profiles")
      .delete()
      .eq("user_id", userData.user.id);

    if (profileDeleteError) {
      throw profileDeleteError;
    }

    const { error: userDeleteError } = await supabase.auth.admin.deleteUser(
      userData.user.id,
    );

    if (userDeleteError) {
      throw userDeleteError;
    }

    await logAuditEvent({
      tenantId: auth.tenant_id,
      actorUserId: userData.user.id,
      action: "profile.self_deleted",
      targetType: "profile",
      targetId: userData.user.id,
      metadata: {
        role: auth.role,
      },
    });

    return ok({ ok: true });
  } catch (error) {
    return serverError(error);
  }
}

import { z } from "zod";
import { getServiceClient } from "@/lib/supabase/server";
import { SERVERONLY_getUserProfile } from "@/lib/supabase/queries";
import { SERVERONLY_getTeamMembers } from "@/lib/supabase/queries";
import { logAuditEvent } from "@/lib/observability/audit";
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
  ok,
  serverError,
  unauthorized,
} from "@/lib/api-utils";

const UpdateRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["tenant_admin", "solicitor", "paralegal"]),
});

const DeleteMemberSchema = z.object({
  userId: z.string().uuid(),
});

const getBearerToken = (request: Request) => {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
};

const requireTeamAccess = async (request: Request) => {
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
      error: forbidden("No organisation associated"),
    };
  }

  return {
    user_id: userData.user.id,
    tenant_id: profile.tenant_id,
    role: profile.role,
  };
};

export async function GET(request: Request) {
  const auth = await requireTeamAccess(request);
  if (auth.error) return auth.error;

  try {
    const members = await SERVERONLY_getTeamMembers(auth.tenant_id);
    return ok({ members });
  } catch (error) {
    return serverError(error);
  }
}

export async function PUT(request: Request) {
  const auth = await requireTeamAccess(request);
  if (auth.error) return auth.error;

  if (auth.role !== "tenant_admin") {
    return forbidden();
  }

  try {
    const raw = await request.json();
    const parsed = UpdateRoleSchema.safeParse(raw);

    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Invalid payload");
    }

    const { userId, role } = parsed.data;
    if (userId === auth.user_id) {
      return conflict("Use a different firm admin to change your role");
    }

    const supabase = getServiceClient();

    const { data: targetProfile, error: targetError } = await supabase
      .from("profiles")
      .select("tenant_id, role, soft_deleted_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (targetError || !targetProfile) {
      return notFound("User not found");
    }

    if (targetProfile.tenant_id !== auth.tenant_id) {
      return forbidden("User is not in your organisation");
    }

    if (targetProfile.role === "tenant_admin" && role !== "tenant_admin") {
      const { count, error: countError } = await supabase
        .from("profiles")
        .select("user_id", { count: "exact", head: true })
        .eq("tenant_id", auth.tenant_id)
        .eq("role", "tenant_admin");

      if (countError) {
        throw countError;
      }

      if ((count ?? 0) <= 1) {
        return conflict("Cannot demote the final firm admin");
      }
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ role })
      .eq("user_id", userId)
      .eq("tenant_id", auth.tenant_id);

    if (updateError) {
      throw updateError;
    }

    await logAuditEvent({
      tenantId: auth.tenant_id,
      actorUserId: auth.user_id,
      action: "team.member.role_updated",
      targetType: "profile",
      targetId: userId,
      metadata: {
        newRole: role,
      },
    });

    return ok({ ok: true });
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(request: Request) {
  const auth = await requireTeamAccess(request);
  if (auth.error) return auth.error;

  if (auth.role !== "tenant_admin") {
    return forbidden();
  }

  try {
    const raw = await request.json();
    const parsed = DeleteMemberSchema.safeParse(raw);

    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Invalid payload");
    }

    const { userId } = parsed.data;

    if (userId === auth.user_id) {
      return conflict("Cannot remove yourself from organisation members");
    }

    const supabase = getServiceClient();

    const { data: targetProfile, error: targetError } = await supabase
      .from("profiles")
      .select("tenant_id, role")
      .eq("user_id", userId)
      .maybeSingle();

    if (targetError || !targetProfile) {
      return notFound("User not found");
    }

    if (targetProfile.tenant_id !== auth.tenant_id) {
      return forbidden("User is not in your organisation");
    }

    if (targetProfile.role === "tenant_admin") {
      return conflict("Cannot remove another firm admin");
    }

    const { error: deleteError } = await supabase
      .from("profiles")
      .update({ soft_deleted_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("tenant_id", auth.tenant_id)
      .is("soft_deleted_at", null);

    if (deleteError) {
      throw deleteError;
    }

    await logAuditEvent({
      tenantId: auth.tenant_id,
      actorUserId: auth.user_id,
      action: "team.member.removed",
      targetType: "profile",
      targetId: userId,
    });

    return ok({ ok: true });
  } catch (error) {
    return serverError(error);
  }
}

export async function PATCH(request: Request) {
  const auth = await requireTeamAccess(request);
  if (auth.error) return auth.error;

  if (auth.role !== "tenant_admin") {
    return forbidden();
  }

  try {
    const raw = await request.json();
    const parsed = DeleteMemberSchema.safeParse(raw);

    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Invalid payload");
    }

    const { userId } = parsed.data;

    if (userId === auth.user_id) {
      return conflict("Cannot restore yourself");
    }

    const supabase = getServiceClient();

    const { data: targetProfile, error: targetError } = await supabase
      .from("profiles")
      .select("tenant_id, role, soft_deleted_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (targetError || !targetProfile) {
      return notFound("User not found");
    }

    if (targetProfile.tenant_id !== auth.tenant_id) {
      return forbidden("User is not in your organisation");
    }

    if (!targetProfile.soft_deleted_at) {
      return conflict("User access is already active");
    }

    const { error: restoreError } = await supabase
      .from("profiles")
      .update({ soft_deleted_at: null })
      .eq("user_id", userId)
      .eq("tenant_id", auth.tenant_id);

    if (restoreError) {
      throw restoreError;
    }

    await logAuditEvent({
      tenantId: auth.tenant_id,
      actorUserId: auth.user_id,
      action: "team.member.restored",
      targetType: "profile",
      targetId: userId,
    });

    return ok({ ok: true });
  } catch (error) {
    return serverError(error);
  }
}

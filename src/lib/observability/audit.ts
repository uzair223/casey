import { getServiceClient } from "@/lib/supabase/server";
import { Json } from "@/types";

type LogAuditEventParams = {
  tenantId?: string | null;
  actorUserId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Json;
};

export const logAuditEvent = async ({
  tenantId = null,
  actorUserId = null,
  action,
  targetType = null,
  targetId = null,
  metadata = {},
  required = false,
}: LogAuditEventParams & { required?: boolean }) => {
  try {
    const supabase = getServiceClient("SERVERONLY_logAuditEvent");
    const { error } = await supabase.from("audit_logs").insert({
      tenant_id: tenantId,
      actor_user_id: actorUserId,
      action,
      target_type: targetType,
      target_id: targetId,
      metadata,
    });
    if (error && required) {
      throw error;
    }
  } catch (error) {
    if (required) {
      throw error;
    }
    // Never block primary business actions due to audit insert failures.
  }
};

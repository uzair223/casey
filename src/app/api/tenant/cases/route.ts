import { NextResponse } from "next/server";

import {
  badRequest,
  forbidden,
  ok,
  requireTenantUser,
  serverError,
} from "@/lib/api-utils";
import { openTenantCase } from "@/lib/billing/open-case";
import { CaseSchema } from "@/lib/schema/case";

const CASE_CREATORS = new Set(["tenant_admin", "solicitor", "paralegal"]);

export async function POST(request: Request) {
  try {
    const auth = await requireTenantUser(request);
    if (!auth.role || !CASE_CREATORS.has(auth.role)) {
      return forbidden("You cannot create a lead");
    }

    const parsed = CaseSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return badRequest("Invalid case");
    }

    const assignedToIds =
      auth.role === "paralegal"
        ? [auth.userId]
        : (parsed.data.assigned_to_ids ?? []);

    if (assignedToIds.length > 0) {
      const uniqueIds = [...new Set(assignedToIds)];
      const { data: members, error } = await auth.supabase
        .from("profiles")
        .select("user_id")
        .eq("tenant_id", auth.tenantId)
        .in("user_id", uniqueIds)
        .is("soft_deleted_at", null);
      if (error) throw error;
      if ((members?.length ?? 0) !== uniqueIds.length) {
        return badRequest("Assignees must belong to this organisation");
      }
    }

    const opened = await openTenantCase(auth.tenantId, {
      title: parsed.data.title,
      case_template_id: parsed.data.case_template_id ?? null,
      case_metadata: parsed.data.case_metadata ?? {},
      assigned_to_ids: assignedToIds,
      status: parsed.data.status,
      contact_name: parsed.data.contact_name,
      contact_email: parsed.data.contact_email,
      contact_phone: parsed.data.contact_phone,
      lead_stage: "intake",
      accepted: true,
    });

    if (!opened.ok) {
      return NextResponse.json(
        { error: opened.error, code: "conflict", gate: opened.gate },
        { status: 409 },
      );
    }

    return ok({ id: opened.id });
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError(error);
  }
}

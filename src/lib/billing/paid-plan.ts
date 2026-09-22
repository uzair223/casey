import "server-only";

import { NextResponse } from "next/server";

import { getServiceClient } from "@/lib/supabase/server";
import { isTenantPlan } from "@/lib/billing/plans";

export async function paidAiDenial(actor: {
  role: string;
  tenantId: string | null;
}) {
  if (actor.role === "app_admin") {
    return null;
  }

  if (!actor.tenantId) {
    return NextResponse.json(
      { error: "No tenant associated" },
      { status: 403 },
    );
  }

  const supabase = getServiceClient("paid-ai");
  const { data: tenant, error } = await supabase
    .from("tenants")
    .select("plan")
    .eq("id", actor.tenantId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const plan = isTenantPlan(tenant?.plan) ? tenant.plan : "trial";
  if (plan !== "trial") {
    return null;
  }

  return NextResponse.json(
    {
      error: "Choose a plan to use this.",
      code: "conflict",
      gate: "practice",
    },
    { status: 409 },
  );
}

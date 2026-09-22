import "server-only";

import { NextResponse } from "next/server";

import { SERVERONLY_getUserProfile } from "@/lib/supabase/queries/auth";
import { getServiceClient } from "@/lib/supabase/server";
import { isTenantPlan } from "@/lib/billing/plans";

export async function paidAiDenial(userId: string) {
  const profile = await SERVERONLY_getUserProfile(userId);
  if (profile?.role === "app_admin") {
    return null;
  }

  if (!profile?.tenant_id) {
    return NextResponse.json(
      { error: "No tenant associated" },
      { status: 403 },
    );
  }

  const supabase = getServiceClient("paid-ai");
  const { data: tenant, error } = await supabase
    .from("tenants")
    .select("plan")
    .eq("id", profile.tenant_id)
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

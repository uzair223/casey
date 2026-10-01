import { conflict, ok, requireAdsManager, serverError } from "@/lib/api-utils";
import { loadAcquisitionBoard } from "@/lib/leads/acquisition/board";
import { runCampaigns } from "@/lib/leads/acquisition/campaigns";
import { ProviderError } from "@/lib/leads/acquisition/http";
import { widgetEnabled } from "@/lib/billing/plans";
import { getServiceClient } from "@/lib/supabase/server";

export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const auth = await requireAdsManager(request);
    const supabase = getServiceClient("acquisition-campaigns");
    const { data: tenant, error } = await supabase
      .from("tenants")
      .select("plan")
      .eq("id", auth.tenantId)
      .maybeSingle();
    if (error) throw error;
    if (!widgetEnabled(tenant?.plan)) {
      return conflict("Running campaigns is part of Growth.");
    }
    const body = (await request.json().catch(() => null)) as {
      action?: string;
      monthlyBudgetGbp?: number;
      places?: string;
    } | null;
    if (body?.action !== "run" && body?.action !== "pause" && body?.action !== "resume") {
      return conflict("Choose run, pause, or resume.");
    }
    const errors = await runCampaigns({
      tenantId: auth.tenantId,
      monthlyBudgetGbp: Number(body.monthlyBudgetGbp),
      action: body.action,
      places: typeof body.places === "string" ? body.places : undefined,
    });
    const board = await loadAcquisitionBoard(auth.tenantId);
    if (errors.length) return conflict(errors.join(" "));
    return ok(board);
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof ProviderError) return conflict(error.message);
    return serverError(error);
  }
}

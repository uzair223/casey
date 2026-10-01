import { conflict, ok, requireAdsManager, serverError } from "@/lib/api-utils";
import { loadAcquisitionBoard } from "@/lib/leads/acquisition/board";
import { applyWebsiteApproval } from "@/lib/leads/acquisition/creative";
import { adoptProposalImages } from "@/lib/leads/acquisition/proposal";
import { loadAdTargeting, saveAdTargeting } from "@/lib/leads/acquisition/targeting";
import { approvedBrandFields } from "@/lib/leads/acquisition/studio";
import { widgetEnabled } from "@/lib/billing/plans";
import { brandingKeepingWelcome } from "@/lib/leads/schema";
import { readLeadBranding } from "@/lib/leads/logo";
import { getServiceClient } from "@/lib/supabase/server";
import type { Json } from "@/types";

export async function POST(request: Request) {
  try {
    const auth = await requireAdsManager(request);
    const supabase = getServiceClient("ad-site-approve");
    const { data: tenant, error } = await supabase
      .from("tenants")
      .select("plan, intake_branding")
      .eq("id", auth.tenantId)
      .maybeSingle();
    if (error) throw error;
    if (!widgetEnabled(tenant?.plan)) return conflict("Running campaigns is part of Growth.");
    const current = await loadAdTargeting(auth.tenantId);
    if (!current.proposal) return conflict("Read the website before approving it.");
    const body = (await request.json().catch(() => null)) as {
      language?: boolean;
      colours?: boolean;
      places?: boolean;
      claims?: boolean;
      imageIds?: string[];
    } | null;
    const imageIds = Array.isArray(body?.imageIds)
      ? body.imageIds.filter((id): id is string => typeof id === "string")
      : [];
    const next = applyWebsiteApproval(current, current.proposal, {
      language: body?.language === true,
      places: body?.places === true,
      claims: body?.claims === true,
      imageIds,
    });
    const chosen = current.proposal.images.filter((image) => imageIds.includes(image.id));
    if (chosen.length) await adoptProposalImages(auth.tenantId, chosen);
    await saveAdTargeting(auth.tenantId, next);
    const patch = approvedBrandFields(current.proposal, {
      language: body?.language === true,
      colours: body?.colours === true,
    });
    if (Object.keys(patch).length) {
      const branding = { ...readLeadBranding(tenant?.intake_branding), ...patch };
      const { error: brandingError } = await supabase
        .from("tenants")
        .update({ intake_branding: branding as Json })
        .eq("id", auth.tenantId);
      if (brandingError) throw brandingError;
      const { data: channels, error: channelError } = await supabase
        .from("lead_channels")
        .select("id, branding")
        .eq("tenant_id", auth.tenantId);
      if (channelError) throw channelError;
      for (const channel of channels ?? []) {
        const channelBranding = brandingKeepingWelcome(branding, readLeadBranding(channel.branding));
        const { error: updateError } = await supabase
          .from("lead_channels")
          .update({ branding: channelBranding as Json })
          .eq("id", channel.id);
        if (updateError) throw updateError;
      }
    }
    return ok(await loadAcquisitionBoard(auth.tenantId));
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError(error);
  }
}

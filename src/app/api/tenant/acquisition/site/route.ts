import { conflict, ok, requireAdsManager, serverError } from "@/lib/api-utils";
import { loadAcquisitionBoard } from "@/lib/leads/acquisition/board";
import { ProviderError } from "@/lib/leads/acquisition/http";
import { storeProposalImages } from "@/lib/leads/acquisition/proposal";
import { readPublicWebsitePage } from "@/lib/leads/acquisition/site-fetch";
import { readWebsiteProposal, websiteUrlError } from "@/lib/leads/acquisition/site";
import { loadAdTargeting, saveAdTargeting } from "@/lib/leads/acquisition/targeting";
import { widgetEnabled } from "@/lib/billing/plans";
import { getServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const auth = await requireAdsManager(request);
    const supabase = getServiceClient("ad-site");
    const { data, error } = await supabase
      .from("tenants")
      .select("plan")
      .eq("id", auth.tenantId)
      .maybeSingle();
    if (error) throw error;
    if (!widgetEnabled(data?.plan)) return conflict("Running campaigns is part of Growth.");
    const body = (await request.json().catch(() => null)) as { url?: string } | null;
    const url = body?.url?.trim() ?? "";
    const invalid = websiteUrlError(url);
    if (invalid) return conflict(invalid);
    const page = await readPublicWebsitePage(url);
    const brief = readWebsiteProposal(page.html, page.url);
    const images = await storeProposalImages(auth.tenantId, brief.imageUrls);
    const current = await loadAdTargeting(auth.tenantId);
    await saveAdTargeting(auth.tenantId, {
      ...current,
      websiteUrl: url,
      proposal: {
        url,
        title: brief.displayName,
        summary: brief.summary,
        welcome: brief.welcome,
        colours: brief.colours,
        images,
        places: brief.places,
        claims: brief.claims,
      },
    });
    return ok(await loadAcquisitionBoard(auth.tenantId));
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof ProviderError) return conflict(error.message);
    return serverError(error);
  }
}

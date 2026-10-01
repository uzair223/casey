import { notFound, requireAdsManager, serverError } from "@/lib/api-utils";
import { proposedImagePath } from "@/lib/leads/acquisition/proposal";
import { loadAdTargeting } from "@/lib/leads/acquisition/targeting";
import { getServiceClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const auth = await requireAdsManager(request);
    const { id } = await params;
    const targeting = await loadAdTargeting(auth.tenantId);
    const image = targeting.proposal?.images.find((item) => item.id === id);
    if (!image) return notFound("Image not found");
    const supabase = getServiceClient("ad-proposal-file");
    const { data, error } = await supabase.storage.from(auth.tenantId).download(proposedImagePath(image.id));
    if (error || !data) return notFound("Image not found");
    return new Response(await data.arrayBuffer(), {
      headers: { "Content-Type": image.contentType, "Cache-Control": "private, max-age=3600" },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError(error);
  }
}

import { FIRM_LOGO_STORAGE_PATH } from "@/lib/leads/logo";
import { getServiceClient } from "@/lib/supabase/server";

type RouteParams = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const { slug } = await params;
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return new Response(null, { status: 404 });
  }

  const supabase = getServiceClient("public-firm-logo");
  const { data: tenant, error } = await supabase
    .from("tenants")
    .select("id")
    .ilike("public_slug", slug)
    .maybeSingle();
  if (error || !tenant) {
    return new Response(null, { status: 404 });
  }

  const { data, error: downloadError } = await supabase.storage
    .from(tenant.id)
    .download(FIRM_LOGO_STORAGE_PATH);
  if (downloadError || !data) {
    return new Response(null, { status: 404 });
  }

  const contentType = data.type.startsWith("image/") ? data.type : "image/png";
  return new Response(data, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

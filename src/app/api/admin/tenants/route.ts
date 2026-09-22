import { z } from "zod";

import {
  badRequest,
  ok,
  requireAppAdmin,
  serverError,
} from "@/lib/api-utils";
import { getServiceClient } from "@/lib/supabase/server";

const BodySchema = z.object({
  name: z.string().trim().min(1).max(200),
});

export async function POST(request: Request) {
  try {
    await requireAppAdmin(request);
    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return badRequest("Organisation name is required");
    }

    const supabase = getServiceClient("admin-create-tenant");
    const { data, error } = await supabase
      .from("tenants")
      .insert({ name: parsed.data.name })
      .select("id, name")
      .single();
    if (error || !data) {
      throw error ?? new Error("Failed to create organisation");
    }

    return ok({ id: data.id, name: data.name });
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError(error);
  }
}

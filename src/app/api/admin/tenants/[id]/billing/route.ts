import { z } from "zod";

import { requireAppAdmin } from "@/lib/api-utils/auth";
import {
  badRequest,
  notFound,
  ok,
  serverError,
} from "@/lib/api-utils";
import { getTenantSeatUsage } from "@/lib/billing/seats";
import { getServiceClient } from "@/lib/supabase/server";

const BodySchema = z.object({
  action: z.literal("save_order"),
  seatLimit: z.number().int().min(1).max(500).optional(),
  dpaSigned: z.boolean().optional(),
  orderFirmName: z.string().trim().min(1).optional(),
  orderStartDate: z.string().trim().optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAppAdmin(request);
    const { id } = await params;
    const supabase = getServiceClient("admin-tenant-billing-get");
    const { data: tenant, error } = await supabase
      .from("tenants")
      .select(
        "id, name, billing_status, seat_limit, dpa_signed_at, order_firm_name, order_start_date, stripe_customer_id, stripe_subscription_id",
      )
      .eq("id", id)
      .maybeSingle();

    if (error || !tenant) {
      return notFound("Organisation not found");
    }

    const seatsUsed = await getTenantSeatUsage(id);
    return ok({ tenant, seatsUsed });
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAppAdmin(request);
    const { id } = await params;
    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return badRequest("Invalid billing request");
    }

    const supabase = getServiceClient("admin-tenant-billing-post");
    const { data: tenant, error } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error || !tenant) {
      return notFound("Organisation not found");
    }

    const seatLimit = parsed.data.seatLimit ?? tenant.seat_limit;
    const orderFirmName =
      parsed.data.orderFirmName ?? tenant.order_firm_name ?? tenant.name;
    const orderStartDate =
      parsed.data.orderStartDate ?? tenant.order_start_date ??
      new Date().toISOString().slice(0, 10);
    const dpaSignedAt = parsed.data.dpaSigned
      ? tenant.dpa_signed_at ?? new Date().toISOString()
      : tenant.dpa_signed_at;

    await supabase
      .from("tenants")
      .update({
        seat_limit: seatLimit,
        order_firm_name: orderFirmName,
        order_start_date: orderStartDate,
        dpa_signed_at: dpaSignedAt,
      })
      .eq("id", id);

    return ok({ updated: true });
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError(error);
  }
}

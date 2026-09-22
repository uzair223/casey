import { z } from "zod";

import { NextResponse } from "next/server";

import {
  badRequest,
  ok,
  requireTenantAdmin,
  serverError,
} from "@/lib/api-utils";
import { FIRM_MIN_SEATS, PRACTICE_SEAT_LIMIT } from "@/lib/billing/plans";
import {
  getStripe,
  getStripeCasePriceId,
  getStripePracticePriceId,
  getStripeSeatPriceId,
} from "@/lib/billing/stripe";
import { env } from "@/lib/env";
import { getServiceClient } from "@/lib/supabase/server";

const BodySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("practice") }),
  z.object({
    kind: z.literal("firm"),
    seats: z.number().int().min(FIRM_MIN_SEATS).max(500),
  }),
  z.object({ kind: z.literal("extra_case") }),
]);

export async function POST(request: Request) {
  try {
    const auth = await requireTenantAdmin(request);
    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return badRequest("Invalid checkout request");
    }

    const supabase = getServiceClient("tenant-billing-checkout");
    const { data: tenant, error } = await supabase
      .from("tenants")
      .select("dpa_signed_at, stripe_customer_id")
      .eq("id", auth.tenantId)
      .maybeSingle();
    if (error || !tenant) {
      throw error ?? new Error("Tenant not found");
    }
    if (!tenant.dpa_signed_at) {
      return NextResponse.json(
        {
          error:
            "Accept the data processing addendum before choosing a plan.",
          code: "dpa_required",
        },
        { status: 409 },
      );
    }

    const stripe = getStripe();
    const dashboardUrl = `${env.NEXT_PUBLIC_BASE_URL}/dashboard`;
    const customer = tenant.stripe_customer_id
      ? { customer: tenant.stripe_customer_id }
      : auth.email
        ? { customer_email: auth.email }
        : {};

    if (parsed.data.kind === "extra_case") {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        success_url: `${dashboardUrl}?billing=success`,
        cancel_url: `${dashboardUrl}?billing=cancelled`,
        client_reference_id: auth.tenantId,
        ...customer,
        metadata: {
          tenantId: auth.tenantId,
          kind: "extra_case",
        },
        line_items: [{ price: getStripeCasePriceId(), quantity: 1 }],
      });
      return ok({ checkoutUrl: session.url });
    }

    const quantity = parsed.data.kind === "practice" ? 1 : parsed.data.seats;
    const seatLimit =
      parsed.data.kind === "practice" ? PRACTICE_SEAT_LIMIT : parsed.data.seats;
    const plan = parsed.data.kind === "practice" ? "practice" : "firm";
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      success_url: `${dashboardUrl}?billing=success`,
      cancel_url: `${dashboardUrl}?billing=cancelled`,
      client_reference_id: auth.tenantId,
      payment_method_collection: "always",
      ...customer,
      metadata: {
        tenantId: auth.tenantId,
        plan,
        kind: plan,
        seatLimit: String(seatLimit),
      },
      subscription_data: {
        metadata: {
          tenantId: auth.tenantId,
          plan,
          seatLimit: String(seatLimit),
        },
      },
      line_items: [
        {
          price:
            parsed.data.kind === "practice"
              ? getStripePracticePriceId()
              : getStripeSeatPriceId(),
          quantity,
        },
      ],
    });

    return ok({ checkoutUrl: session.url });
  } catch (error) {
    if (error instanceof Response) return error;
    return serverError(error);
  }
}

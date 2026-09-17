import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { getStripe } from "@/lib/billing/stripe";
import { getServiceClient } from "@/lib/supabase/server";

function billingStatusFromStripe(status: string | null | undefined) {
  if (status === "active" || status === "trialing") return "active";
  if (status === "past_due" || status === "unpaid") return "past_due";
  if (status === "canceled" || status === "incomplete_expired") {
    return "canceled";
  }
  return "trial";
}

export async function POST(request: Request) {
  try {
    const stripe = getStripe();
    const signature = request.headers.get("stripe-signature");
    if (!signature || !env.STRIPE_WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await request.text();
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
    const supabase = getServiceClient("stripe-webhook");

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const tenantId =
        session.metadata?.tenantId || session.client_reference_id;
      if (!tenantId) {
        return NextResponse.json({ ok: true });
      }
      const seatLimit = Number(session.metadata?.seatLimit || 0);
      let billingStatus: "active" | "trial" | "past_due" | "canceled" =
        "active";
      if (typeof session.subscription === "string") {
        const subscription = await stripe.subscriptions.retrieve(
          session.subscription,
        );
        billingStatus = billingStatusFromStripe(subscription.status);
      }
      await supabase
        .from("tenants")
        .update({
          stripe_customer_id:
            typeof session.customer === "string" ? session.customer : null,
          stripe_subscription_id:
            typeof session.subscription === "string"
              ? session.subscription
              : null,
          billing_status: billingStatus,
          ...(seatLimit > 0 ? { seat_limit: seatLimit } : {}),
        })
        .eq("id", tenantId);
    }

    if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const subscription = event.data.object;
      const tenantId = subscription.metadata?.tenantId;
      const quantity = subscription.items.data[0]?.quantity;
      if (tenantId) {
        await supabase
          .from("tenants")
          .update({
            billing_status: billingStatusFromStripe(subscription.status),
            stripe_subscription_id: subscription.id,
            ...(typeof quantity === "number" ? { seat_limit: quantity } : {}),
          })
          .eq("id", tenantId);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Stripe webhook failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { env } from "@/lib/env";
import { getStripe } from "@/lib/billing/stripe";
import { STARTER_INCLUDED_USERS, GROWTH_INCLUDED_USERS, normalizeTenantPlan } from "@/lib/billing/plans";
import { getServiceClient } from "@/lib/supabase/server";

function billingStatusFromStripe(status: string | null | undefined) {
  if (status === "active" || status === "trialing") return "active";
  if (status === "past_due" || status === "unpaid") return "past_due";
  if (status === "canceled" || status === "incomplete_expired") {
    return "canceled";
  }
  return "trial";
}

function planFromSubscription(
  subscription: Stripe.Subscription,
): "starter" | "growth" | null {
  const metadataPlan = subscription.metadata?.plan;
  const normalized = normalizeTenantPlan(metadataPlan);
  if (metadataPlan === "starter" || metadataPlan === "growth" || metadataPlan === "practice" || metadataPlan === "firm") {
    return normalized === "trial" ? null : normalized;
  }
  const priceId = subscription.items.data[0]?.price?.id;
  if (priceId && priceId === env.STRIPE_PRACTICE_PRICE_ID) return "starter";
  if (priceId && priceId === env.STRIPE_GROWTH_PRICE_ID) return "growth";
  if (priceId && priceId === env.STRIPE_SEAT_PRICE_ID) return "growth";
  return null;
}

function periodStartIso(subscription: Stripe.Subscription) {
  const start = subscription.items.data[0]?.current_period_start;
  if (!start) return null;
  return new Date(start * 1000).toISOString();
}

function seatLimitFor(
  plan: "starter" | "growth",
  subscription: Stripe.Subscription,
) {
  if (plan === "starter") return STARTER_INCLUDED_USERS;
  const metadataLimit = Number(subscription.metadata?.seatLimit || 0);
  return Math.max(GROWTH_INCLUDED_USERS, metadataLimit || 0);
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

      if (
        session.metadata?.kind === "extra_case" ||
        session.metadata?.kind === "extra_lead"
      ) {
        const { data: tenant, error } = await supabase
          .from("tenants")
          .select("overage_credits, last_overage_checkout_session_id")
          .eq("id", tenantId)
          .maybeSingle();
        if (error || !tenant) {
          throw error ?? new Error("Tenant not found");
        }
        if (tenant.last_overage_checkout_session_id === session.id) {
          return NextResponse.json({ received: true });
        }
        const { data: updated, error: updateError } = await supabase
          .from("tenants")
          .update({
            overage_credits: tenant.overage_credits + 1,
            last_overage_checkout_session_id: session.id,
            stripe_customer_id:
              typeof session.customer === "string"
                ? session.customer
                : undefined,
          })
          .eq("id", tenantId)
          .eq("overage_credits", tenant.overage_credits)
          .select("id");
        if (updateError) throw updateError;
        if (!updated?.length) {
          const { data: again } = await supabase
            .from("tenants")
            .select("last_overage_checkout_session_id")
            .eq("id", tenantId)
            .maybeSingle();
          if (again?.last_overage_checkout_session_id === session.id) {
            return NextResponse.json({ received: true });
          }
          throw new Error("Could not store the extra case");
        }
        return NextResponse.json({ received: true });
      }

      const metadataPlan = session.metadata?.plan;
      const plan: "starter" | "growth" | null =
        metadataPlan === "starter" || metadataPlan === "practice"
          ? "starter"
          : metadataPlan === "growth" || metadataPlan === "firm"
            ? "growth"
            : null;
      let billingStatus: "active" | "trial" | "past_due" | "canceled" =
        "active";
      let periodStart: string | null = null;
      let seatLimit = Number(session.metadata?.seatLimit || 0);
      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : null;
      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        billingStatus = billingStatusFromStripe(subscription.status);
        periodStart = periodStartIso(subscription);
        const subscriptionPlan = planFromSubscription(subscription) ?? plan;
        if (subscriptionPlan) {
          seatLimit = seatLimitFor(subscriptionPlan, subscription);
        }
      }

      const { data: existing } = await supabase
        .from("tenants")
        .select("stripe_subscription_id")
        .eq("id", tenantId)
        .maybeSingle();

      await supabase
        .from("tenants")
        .update({
          stripe_customer_id:
            typeof session.customer === "string" ? session.customer : null,
          stripe_subscription_id: subscriptionId,
          billing_status: billingStatus,
          ...(plan ? { plan } : {}),
          ...(seatLimit > 0 ? { seat_limit: seatLimit } : {}),
          ...(periodStart ? { billing_period_start: periodStart } : {}),
        })
        .eq("id", tenantId);

      const previousId = existing?.stripe_subscription_id;
      if (previousId && subscriptionId && previousId !== subscriptionId) {
        try {
          await stripe.subscriptions.cancel(previousId);
        } catch {
          // A repeated webhook can arrive after the previous subscription is gone.
        }
      }
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const subscription = event.data.object;
      const tenantId = subscription.metadata?.tenantId;
      if (tenantId) {
        const { data: current } = await supabase
          .from("tenants")
          .select("stripe_subscription_id")
          .eq("id", tenantId)
          .maybeSingle();
        const storedId = current?.stripe_subscription_id;
        if (storedId && storedId !== subscription.id) {
          return NextResponse.json({ received: true });
        }
        const nextStatus = billingStatusFromStripe(subscription.status);
        if (storedId === subscription.id && nextStatus === "trial") {
          return NextResponse.json({ received: true });
        }

        const plan = planFromSubscription(subscription);
        const periodStart = periodStartIso(subscription);
        await supabase
          .from("tenants")
          .update({
            billing_status: nextStatus,
            stripe_subscription_id: subscription.id,
            ...(plan
              ? { plan, seat_limit: seatLimitFor(plan, subscription) }
              : {}),
            ...(periodStart ? { billing_period_start: periodStart } : {}),
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

import "server-only";

import type Stripe from "stripe";

import { getServiceClient } from "@/lib/supabase/server";

import { getStripe } from "./stripe";
import type { SubscriptionSummary } from "./subscription-summary";

export type { SubscriptionSummary };

const emptySummary: SubscriptionSummary = {
  hasSubscription: false,
  cancelAtPeriodEnd: false,
  periodEnd: null,
};

function periodEndIso(subscription: Stripe.Subscription) {
  const end =
    (subscription.cancel_at_period_end ? subscription.cancel_at : null) ??
    subscription.items.data[0]?.current_period_end ??
    null;
  if (!end) return null;
  return new Date(end * 1000).toISOString();
}

function summarize(subscription: Stripe.Subscription): SubscriptionSummary {
  if (
    subscription.status === "canceled" ||
    subscription.status === "incomplete_expired"
  ) {
    return emptySummary;
  }
  return {
    hasSubscription: true,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    periodEnd: periodEndIso(subscription),
  };
}

function isMissingSubscription(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "resource_missing"
  );
}

function nextMonthlyRenewal(startIso: string) {
  const renew = new Date(startIso);
  if (Number.isNaN(renew.getTime())) return null;
  do {
    renew.setUTCMonth(renew.getUTCMonth() + 1);
  } while (renew.getTime() <= Date.now());
  return renew.toISOString();
}

async function tenantBilling(tenantId: string) {
  const supabase = getServiceClient("tenant-subscription");
  const { data, error } = await supabase
    .from("tenants")
    .select("stripe_subscription_id, billing_status, billing_period_start")
    .eq("id", tenantId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function fallbackPeriodEnd(
  tenant: {
    billing_status: string;
    billing_period_start: string | null;
  } | null,
) {
  if (!tenant?.billing_period_start) return null;
  if (tenant.billing_status !== "active" && tenant.billing_status !== "past_due") {
    return null;
  }
  return nextMonthlyRenewal(tenant.billing_period_start);
}

export async function getTenantSubscriptionSummary(
  tenantId: string,
): Promise<SubscriptionSummary> {
  const tenant = await tenantBilling(tenantId);
  const periodEnd = fallbackPeriodEnd(tenant);
  if (!tenant?.stripe_subscription_id) {
    return { ...emptySummary, periodEnd };
  }
  try {
    const subscription = await getStripe().subscriptions.retrieve(
      tenant.stripe_subscription_id,
    );
    const summary = summarize(subscription);
    if (!summary.hasSubscription) return emptySummary;
    return { ...summary, periodEnd: summary.periodEnd ?? periodEnd };
  } catch (error) {
    if (isMissingSubscription(error)) {
      return { ...emptySummary, periodEnd };
    }
    throw error;
  }
}

export async function setSubscriptionCancelAtPeriodEnd(
  tenantId: string,
  cancelAtPeriodEnd: boolean,
): Promise<SubscriptionSummary | null> {
  const tenant = await tenantBilling(tenantId);
  const subscriptionId = tenant?.stripe_subscription_id ?? null;
  if (!subscriptionId) return null;
  const subscription = await getStripe().subscriptions.update(subscriptionId, {
    cancel_at_period_end: cancelAtPeriodEnd,
  });
  return summarize(subscription);
}

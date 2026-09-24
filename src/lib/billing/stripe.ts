import "server-only";

import Stripe from "stripe";

import { env } from "@/lib/env";

/** SaaS sold to businesses. Required by Stripe Managed Payments. */
export const SAAS_BUSINESS_TAX_CODE = "txcd_10103001";

let stripeClient: Stripe | null = null;
const taxCodeEnsuredPriceIds = new Set<string>();

export function getStripe() {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
}

export function getStripeSeatPriceId() {
  if (!env.STRIPE_SEAT_PRICE_ID) {
    throw new Error("Missing STRIPE_SEAT_PRICE_ID");
  }
  return env.STRIPE_SEAT_PRICE_ID;
}

export function getStripePracticePriceId() {
  if (!env.STRIPE_PRACTICE_PRICE_ID) {
    throw new Error("Missing STRIPE_PRACTICE_PRICE_ID");
  }
  return env.STRIPE_PRACTICE_PRICE_ID;
}

export function getStripeCasePriceId() {
  if (!env.STRIPE_CASE_PRICE_ID) {
    throw new Error("Missing STRIPE_CASE_PRICE_ID");
  }
  return env.STRIPE_CASE_PRICE_ID;
}

export function getStripeGrowthPriceId() {
  if (!env.STRIPE_GROWTH_PRICE_ID) {
    throw new Error("Missing STRIPE_GROWTH_PRICE_ID");
  }
  return env.STRIPE_GROWTH_PRICE_ID;
}

function taxCodeId(taxCode: string | Stripe.TaxCode | null | undefined) {
  if (!taxCode) return null;
  return typeof taxCode === "string" ? taxCode : taxCode.id;
}

/** Managed Payments rejects checkout when the product has no eligible tax code. */
export async function ensurePriceTaxCode(priceId: string) {
  if (taxCodeEnsuredPriceIds.has(priceId)) return;
  const stripe = getStripe();
  const price = await stripe.prices.retrieve(priceId, { expand: ["product"] });
  const product = price.product;
  if (typeof product !== "string" && product.deleted) return;
  const productId = typeof product === "string" ? product : product.id;
  const current =
    typeof product === "string" ? null : taxCodeId(product.tax_code);
  if (current !== SAAS_BUSINESS_TAX_CODE) {
    await stripe.products.update(productId, {
      tax_code: SAAS_BUSINESS_TAX_CODE,
    });
  }
  taxCodeEnsuredPriceIds.add(priceId);
}

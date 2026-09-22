import "server-only";

import Stripe from "stripe";

import { env } from "@/lib/env";

let stripeClient: Stripe | null = null;

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

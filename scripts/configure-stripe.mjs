import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import Stripe from "stripe";

const envPath = resolve(process.cwd(), ".env");

function loadEnvFile(path) {
  const values = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#") || !line.includes("=")) {
      continue;
    }
    const index = line.indexOf("=");
    values[line.slice(0, index)] = line.slice(index + 1);
  }
  return values;
}

function upsertEnv(path, updates) {
  const original = readFileSync(path, "utf8");
  const keys = new Set(Object.keys(updates));
  const lines = original.split(/\r?\n/);
  const next = lines.map((line) => {
    if (!line.trim() || line.trim().startsWith("#") || !line.includes("=")) {
      return line;
    }
    const index = line.indexOf("=");
    const key = line.slice(0, index);
    if (keys.has(key) && updates[key] != null) {
      keys.delete(key);
      return `${key}=${updates[key]}`;
    }
    return line;
  });
  for (const key of keys) {
    if (updates[key]) {
      next.push(`${key}=${updates[key]}`);
    }
  }
  writeFileSync(path, `${next.filter((line, i) => i < next.length - 1 || line !== "").join("\n")}\n`);
}

const fileEnv = loadEnvFile(envPath);
const stripeKey = fileEnv.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
if (!stripeKey) {
  throw new Error("STRIPE_SECRET_KEY is missing from .env");
}

const stripe = new Stripe(stripeKey);
const livemode = stripeKey.includes("_live");
let stripeAccount = null;
try {
  stripeAccount = await stripe.accounts.retrieve();
} catch {
  stripeAccount = null;
}

const products = await stripe.products.list({ limit: 100, active: true });
let product = products.data.find(
  (item) => item.metadata?.casey_product === "seats" || item.name === "Casey seat",
);
if (!product) {
  product = await stripe.products.create({
    name: "Casey seat",
    description: "Monthly licensed Casey workspace seat",
    metadata: { casey_product: "seats" },
  });
}

const prices = await stripe.prices.list({
  product: product.id,
  active: true,
  limit: 100,
});
let price = prices.data.find(
  (item) =>
    item.metadata?.casey_price === "seat_monthly" ||
    (item.recurring?.interval === "month" &&
      item.currency === "gbp" &&
      item.unit_amount === 4900),
);
if (!price) {
  price = await stripe.prices.create({
    product: product.id,
    currency: "gbp",
    unit_amount: 4900,
    recurring: { interval: "month" },
    metadata: { casey_price: "seat_monthly" },
    nickname: "Casey seat monthly",
  });
}

const cfAccountId =
  fileEnv.CLOUDFLARE_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
const cfToken = fileEnv.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
let caseyUrl = fileEnv.NEXT_PUBLIC_BASE_URL || "";
let docusealUrl = fileEnv.DOCUSEAL_URL || "";
if (cfAccountId && cfToken) {
  const subdomainRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/workers/subdomain`,
    { headers: { Authorization: `Bearer ${cfToken}` } },
  );
  const subdomainJson = (await subdomainRes.json()) ;
  const subdomain = subdomainJson?.result?.subdomain;
  if (subdomain) {
    caseyUrl = `https://casey.${subdomain}.workers.dev`;
    docusealUrl = `https://casey-docuseal.${subdomain}.workers.dev`;
  }
}

let webhookSecret = fileEnv.STRIPE_WEBHOOK_SECRET || "";
if (caseyUrl.startsWith("https://")) {
  const webhookUrl = `${caseyUrl.replace(/\/$/, "")}/api/webhooks/stripe`;
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
  let endpoint = endpoints.data.find((item) => item.url === webhookUrl);
  if (!endpoint) {
    endpoint = await stripe.webhookEndpoints.create({
      url: webhookUrl,
      enabled_events: [
        "checkout.session.completed",
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
      ],
      metadata: { casey: "true" },
    });
    webhookSecret = endpoint.secret || webhookSecret;
  } else if (!webhookSecret) {
    await stripe.webhookEndpoints.del(endpoint.id);
    endpoint = await stripe.webhookEndpoints.create({
      url: webhookUrl,
      enabled_events: [
        "checkout.session.completed",
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
      ],
      metadata: { casey: "true" },
    });
    webhookSecret = endpoint.secret || webhookSecret;
  }
}

const secretUpdates = {
  STRIPE_SEAT_PRICE_ID: price.id,
};
if (webhookSecret) {
  secretUpdates.STRIPE_WEBHOOK_SECRET = webhookSecret;
}
if (!fileEnv.DOCUSEAL_SECRET_KEY_BASE) {
  secretUpdates.DOCUSEAL_SECRET_KEY_BASE = randomBytes(64).toString("hex");
}
if (!fileEnv.DOCUSEAL_WEBHOOK_SECRET) {
  secretUpdates.DOCUSEAL_WEBHOOK_SECRET = `whsec_${randomBytes(32).toString("hex")}`;
}

upsertEnv(envPath, secretUpdates);

console.log(
  JSON.stringify(
    {
      stripeLivemode: livemode,
      stripeAccount: stripeAccount?.id ?? null,
      productId: product.id,
      priceId: price.id,
      amount: "£49 / seat / month",
      trialDays: 7,
      caseyUrl: caseyUrl || null,
      docusealUrl: docusealUrl || null,
      webhookCreated: Boolean(webhookSecret),
    },
    null,
    2,
  ),
);

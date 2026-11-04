// Configura Stripe in modalità TEST: i 3 piani, il webhook e il portale clienti.
// Uso:  npm run stripe:setup
// Si può rilanciare: riusa ciò che esiste già invece di creare doppioni.
// I codici creati vengono scritti in .env.local.
import { readFileSync } from "node:fs";
import { readEnv, writeEnvValues } from "./env-file.mjs";

const SITE_URL = process.argv[2] ?? "https://aura-ten-ebon.vercel.app";
const WEBHOOK_URL = `${SITE_URL}/api/stripe/webhook`;
const WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
];

const env = readEnv();
const key = env.STRIPE_SECRET_KEY;
if (!key) fail("Manca STRIPE_SECRET_KEY in .env.local.");
if (!key.startsWith("sk_test_")) fail("Per sicurezza questo script accetta solo chiavi di TEST (sk_test_...).");

// Piani e prezzi letti da src/lib/plans.ts, così restano allineati alla landing
const plansSource = readFileSync(new URL("../src/lib/plans.ts", import.meta.url), "utf8");
const plans = [...plansSource.matchAll(/id: "(\w+)",\s*name: "([^"]+)",\s*price: (\d+)/g)].map(([, id, name, price]) => ({
  id,
  name,
  cents: Number(price) * 100,
}));
if (plans.length !== 3) fail("Non riesco a leggere i 3 piani da src/lib/plans.ts.");

function encode(params, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    const name = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => (typeof item === "object" ? encode(item, `${name}[${i}]`, out) : out.append(`${name}[${i}]`, String(item))));
    else if (typeof v === "object") encode(v, name, out);
    else out.append(name, String(v));
  }
  return out;
}

async function stripe(method, path, params = {}) {
  const body = encode(params);
  const url = `https://api.stripe.com/v1/${path}${method === "GET" && body.size ? `?${body}` : ""}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: method === "GET" ? undefined : body,
  });
  const json = await res.json();
  if (!res.ok) fail(`Stripe ha risposto con un errore (${path}): ${json?.error?.message}`);
  return json;
}

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

const updates = {};

// 1. Piani: un prezzo mensile ricorrente per piano, IVA esclusa
for (const plan of plans) {
  const lookupKey = `smartbooking_${plan.id}_mensile`;
  const found = await stripe("GET", "prices", { lookup_keys: [lookupKey], active: true });
  let price = found.data.find((p) => p.unit_amount === plan.cents);
  if (price) {
    console.log(`✓ Piano ${plan.name}: già presente (${price.id})`);
  } else {
    price = await stripe("POST", "prices", {
      currency: "eur",
      unit_amount: plan.cents,
      recurring: { interval: "month" },
      tax_behavior: "exclusive",
      lookup_key: lookupKey,
      transfer_lookup_key: true,
      product_data: { name: `SmartBooking AI ${plan.name}` },
    });
    console.log(`✓ Piano ${plan.name}: creato a ${plan.cents / 100} €/mese (${price.id})`);
  }
  updates[`STRIPE_PRICE_${plan.id.toUpperCase()}`] = price.id;
}

// 2. Webhook: il segreto si vede solo alla creazione, quindi se manca lo si ricrea
const endpoints = await stripe("GET", "webhook_endpoints", { limit: 100 });
const existing = endpoints.data.find((e) => e.url === WEBHOOK_URL);
if (existing && env.STRIPE_WEBHOOK_SECRET) {
  await stripe("POST", `webhook_endpoints/${existing.id}`, { enabled_events: WEBHOOK_EVENTS });
  console.log(`✓ Webhook: già presente per ${WEBHOOK_URL}`);
} else {
  if (existing) await stripe("DELETE", `webhook_endpoints/${existing.id}`);
  const created = await stripe("POST", "webhook_endpoints", {
    url: WEBHOOK_URL,
    enabled_events: WEBHOOK_EVENTS,
    description: "SmartBooking AI: abbonamenti",
  });
  updates.STRIPE_WEBHOOK_SECRET = created.secret;
  console.log(`✓ Webhook: creato per ${WEBHOOK_URL}`);
}

// 3. Portale clienti (fatture, carta, disdetta a fine periodo)
const configs = await stripe("GET", "billing_portal/configurations", { limit: 100 });
let portal = configs.data.find((c) => c.metadata?.app === "smartbooking");
if (!portal) {
  portal = await stripe("POST", "billing_portal/configurations", {
    business_profile: { headline: "Gestisci il tuo abbonamento SmartBooking AI" },
    features: {
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      customer_update: { enabled: true, allowed_updates: ["email", "address", "tax_id"] },
      subscription_cancel: { enabled: true, mode: "at_period_end" },
    },
    metadata: { app: "smartbooking" },
  });
  console.log("✓ Portale clienti: creato");
} else {
  console.log("✓ Portale clienti: già presente");
}
updates.STRIPE_PORTAL_CONFIGURATION = portal.id;

writeEnvValues(updates);
console.log("\n✓ Fatto. I codici sono stati salvati in .env.local.");
console.log("  Prossimo passo: npm run env:vercel  (copia le chiavi su Vercel)\n");

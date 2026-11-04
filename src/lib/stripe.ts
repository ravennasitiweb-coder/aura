import "server-only";
import type { PlanId } from "@/lib/plans";

export { verifyStripeSignature } from "@/lib/stripe-signature";

// Integrazione Stripe tramite la sua API HTTP, senza librerie.
// Si attiva solo con STRIPE_SECRET_KEY e almeno un prezzo STRIPE_PRICE_*.
// Con chiavi di test (sk_test_...) nessun pagamento è reale.

const PRICE_ENV: Record<PlanId, string> = {
  solo: "STRIPE_PRICE_SOLO",
  salone: "STRIPE_PRICE_SALONE",
  studio: "STRIPE_PRICE_STUDIO",
};

export function priceIdFor(plan: PlanId) {
  return process.env[PRICE_ENV[plan]] || null;
}

export function planForPriceId(priceId: string | undefined): PlanId | null {
  if (!priceId) return null;
  return (Object.keys(PRICE_ENV) as PlanId[]).find((p) => priceIdFor(p) === priceId) ?? null;
}

export function stripeEnabled() {
  return Boolean(process.env.STRIPE_SECRET_KEY) && (Object.keys(PRICE_ENV) as PlanId[]).some((p) => priceIdFor(p));
}

// Stripe vuole i parametri "a parentesi": line_items[0][price]=...
function encode(params: Record<string, unknown>, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") encode(v as Record<string, unknown>, key, out);
    else out.append(key, String(v));
  }
  return out;
}

export async function stripeRequest<T>(method: "GET" | "POST", path: string, params: Record<string, unknown> = {}): Promise<T> {
  const body = encode(params);
  const url = `https://api.stripe.com/v1/${path}${method === "GET" && body.size ? `?${body}` : ""}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: method === "POST" ? body : undefined,
    signal: AbortSignal.timeout(10000),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Stripe ${res.status}: ${json?.error?.message ?? "errore sconosciuto"}`);
  return json as T;
}

export type StripeSubscription = {
  id: string;
  customer: string;
  status: string;
  metadata?: { salon_id?: string };
  current_period_end?: number;
  items: { data: { price: { id: string }; current_period_end?: number }[] };
};

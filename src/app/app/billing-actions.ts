"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { TRIAL_DAYS, type PlanId } from "@/lib/plans";
import { priceIdFor, stripeEnabled, stripeRequest } from "@/lib/stripe";

// Pagamento e gestione dell'abbonamento: si apre la pagina sicura di Stripe,
// i dati della carta non passano mai dal nostro server.

async function origin() {
  return (await headers()).get("origin") ?? "http://localhost:3000";
}

export async function startCheckout(plan: PlanId) {
  const { supabase, salon, user } = await requireOwner();
  const price = priceIdFor(plan);
  if (!stripeEnabled() || !price) redirect("/app/abbonamento?esito=non-attivo");

  const { data: existing } = await supabase.from("subscriptions").select("stripe_customer_id").eq("salon_id", salon.id).maybeSingle();
  const base = await origin();

  const session = await stripeRequest<{ url: string }>("POST", "checkout/sessions", {
    mode: "subscription",
    line_items: { 0: { price, quantity: 1 } },
    client_reference_id: salon.id,
    // Primo mese gratis solo a chi non ha mai avuto un abbonamento
    subscription_data: { metadata: { salon_id: salon.id }, trial_period_days: existing?.stripe_customer_id ? undefined : TRIAL_DAYS },
    customer: existing?.stripe_customer_id ?? undefined,
    customer_email: existing?.stripe_customer_id ? undefined : user.email,
    allow_promotion_codes: true,
    locale: "it",
    success_url: `${base}/app/abbonamento?esito=ok`,
    cancel_url: `${base}/app/abbonamento?esito=annullato`,
  });
  redirect(session.url);
}

export async function openBillingPortal() {
  const { supabase, salon } = await requireOwner();
  const { data } = await supabase.from("subscriptions").select("stripe_customer_id").eq("salon_id", salon.id).maybeSingle();
  if (!data?.stripe_customer_id || !stripeEnabled()) redirect("/app/abbonamento");

  const portal = await stripeRequest<{ url: string }>("POST", "billing_portal/sessions", {
    customer: data.stripe_customer_id,
    configuration: process.env.STRIPE_PORTAL_CONFIGURATION || undefined,
    return_url: `${await origin()}/app/abbonamento`,
  });
  redirect(portal.url);
}

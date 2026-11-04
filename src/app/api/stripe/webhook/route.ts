import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { planForPriceId, stripeRequest, verifyStripeSignature, type StripeSubscription } from "@/lib/stripe";

// Stripe chiama questo indirizzo quando un abbonamento viene creato,
// rinnovato, modificato o disdetto. Ci si fida del messaggio solo se la
// firma è valida: altrimenti chiunque potrebbe "attivarsi" un abbonamento.

type StripeEvent = { type: string; data: { object: Record<string, unknown> } };

export async function POST(request: NextRequest) {
  const payload = await request.text();
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  if (!verifyStripeSignature(payload, request.headers.get("stripe-signature"), secret)) {
    return NextResponse.json({ error: "Firma non valida" }, { status: 400 });
  }

  const event = JSON.parse(payload) as StripeEvent;

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as { subscription?: string; client_reference_id?: string };
      if (session.subscription && session.client_reference_id) {
        const sub = await stripeRequest<StripeSubscription>("GET", `subscriptions/${session.subscription}`);
        await saveSubscription(session.client_reference_id, sub);
      }
    } else if (event.type.startsWith("customer.subscription.")) {
      const sub = event.data.object as unknown as StripeSubscription;
      const salonId = sub.metadata?.salon_id;
      if (salonId) await saveSubscription(salonId, sub);
    }
  } catch (err) {
    console.error("Webhook Stripe non elaborato", err);
    // 500: Stripe riproverà più tardi
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function saveSubscription(salonId: string, sub: StripeSubscription) {
  const item = sub.items?.data?.[0];
  // Nelle versioni recenti dell'API la scadenza è sulla voce dell'abbonamento
  const periodEnd = sub.current_period_end ?? item?.current_period_end;
  const admin = createAdminClient();
  const { error } = await admin.from("subscriptions").upsert(
    {
      salon_id: salonId,
      stripe_customer_id: sub.customer,
      stripe_subscription_id: sub.id,
      plan: planForPriceId(item?.price?.id),
      status: sub.status,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "salon_id" },
  );
  if (error) throw new Error(error.message);
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { openBillingPortal, startCheckout } from "@/app/app/billing-actions";
import { PageHeader } from "@/components/app/ui";
import { getCurrentSalon } from "@/lib/auth";
import { PLANS } from "@/lib/plans";
import { priceIdFor, stripeEnabled } from "@/lib/stripe";

export const metadata: Metadata = { title: "Abbonamento — SmartBooking" };

const STATUS_LABEL: Record<string, string> = {
  active: "Attivo",
  trialing: "In prova",
  past_due: "Pagamento in ritardo",
  unpaid: "Non pagato",
  canceled: "Disdetto",
  incomplete: "Pagamento da completare",
  incomplete_expired: "Pagamento scaduto",
  paused: "In pausa",
};

const MESSAGES: Record<string, string> = {
  ok: "Grazie! Il pagamento è andato a buon fine: l'abbonamento compare qui entro pochi secondi.",
  annullato: "Pagamento annullato: non è stato addebitato nulla.",
  "non-attivo": "I pagamenti non sono ancora attivi.",
};

const dateFormat = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Rome" });

export default function BillingPage({ searchParams }: PageProps<"/app/abbonamento">) {
  return (
    <>
      <PageHeader title="Abbonamento" description="Il piano della tua attività. Paghi con carta in modo sicuro tramite Stripe e puoi disdire quando vuoi." />
      <Suspense fallback={<p className="text-ink-soft">Caricamento…</p>}>
        <Billing searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Billing({ searchParams }: { searchParams: PageProps<"/app/abbonamento">["searchParams"] }) {
  const { esito } = await searchParams;
  const { supabase, salon, role } = await getCurrentSalon();
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan, status, current_period_end, stripe_customer_id")
    .eq("salon_id", salon.id)
    .maybeSingle();

  const enabled = stripeEnabled();
  const isOwner = role === "owner";
  const active = sub && ["active", "trialing", "past_due"].includes(sub.status ?? "");
  const message = typeof esito === "string" ? MESSAGES[esito] : undefined;

  return (
    <div className="space-y-8">
      {message && <p role="status" className="rounded-xl bg-mint px-4 py-3 text-bottle-dark">{message}</p>}

      {!enabled && (
        <p className="rounded-2xl border border-line bg-white p-5 text-ink-soft">
          I pagamenti non sono ancora attivi: durante il periodo di lancio SmartBooking si usa gratis.
        </p>
      )}

      {sub && (
        <section className="rounded-2xl border border-line bg-white p-6">
          <p className="text-sm text-ink-soft">Il tuo abbonamento</p>
          <p className="font-display text-2xl font-bold">
            {PLANS.find((p) => p.id === sub.plan)?.name ?? "Piano"}: {STATUS_LABEL[sub.status ?? ""] ?? sub.status}
          </p>
          {sub.current_period_end && (
            <p className="mt-1 text-ink-soft">
              {sub.status === "canceled" ? "Terminato il" : "Prossimo rinnovo il"} {dateFormat.format(new Date(sub.current_period_end))}
            </p>
          )}
          {isOwner && enabled && sub.stripe_customer_id && (
            <form action={openBillingPortal} className="mt-4">
              <button type="submit" className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold hover:border-ink">
                Gestisci pagamento, fatture e disdetta
              </button>
            </form>
          )}
        </section>
      )}

      {!active && (
        <div className="grid gap-5 md:grid-cols-3">
          {PLANS.map((p) => {
            const available = enabled && Boolean(priceIdFor(p.id));
            return (
              <div key={p.id} className={`flex flex-col rounded-3xl p-6 ${p.highlight ? "bg-bottle text-white" : "border border-line bg-white"}`}>
                <h2 className="font-display text-xl font-bold">{p.name}</h2>
                <p className={p.highlight ? "text-mint" : "text-ink-soft"}>{p.text}</p>
                <p className="mt-4 font-display text-4xl font-bold">
                  {p.price} €<span className="text-base font-normal"> / mese + IVA</span>
                </p>
                <ul className="mt-4 flex-1 space-y-1.5 text-sm">
                  {p.items.map((it) => (
                    <li key={it} className="flex gap-2">
                      <span aria-hidden="true">✓</span>
                      {it}
                    </li>
                  ))}
                </ul>
                {isOwner && available && (
                  <form action={startCheckout.bind(null, p.id)} className="mt-6">
                    <button
                      type="submit"
                      className={`w-full rounded-full px-5 py-3 font-semibold ${p.highlight ? "bg-white text-bottle hover:bg-mint" : "bg-ink text-white hover:bg-bottle-dark"}`}
                    >
                      Scegli {p.name}
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
      {!isOwner && <p className="text-sm text-ink-soft">Solo il titolare può gestire l&apos;abbonamento.</p>}
    </div>
  );
}

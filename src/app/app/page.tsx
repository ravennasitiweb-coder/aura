import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getMemberships, requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Il tuo salone — SmartBooking AI" };

export default function AppHomePage() {
  // La parte che dipende dall'utente si carica dentro <Suspense>:
  // così Next.js può mostrare subito il resto della pagina.
  return (
    <Suspense fallback={<p className="text-ink-soft">Caricamento del tuo salone…</p>}>
      <SalonOverview />
    </Suspense>
  );
}

async function SalonOverview() {
  const { user } = await requireUser();
  const memberships = await getMemberships();
  if (memberships.length === 0) redirect("/app/onboarding");

  const { salon, role } = memberships[0];

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-ink-soft">
          {role === "owner" ? "Titolare" : "Collaboratore"}, {user.email}
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight">{salon.name}</h1>
        {salon.city && <p className="text-ink-soft">{salon.city}</p>}
      </div>

      <div className="rounded-2xl border border-line bg-white p-6">
        <h2 className="font-semibold">Il tuo indirizzo di prenotazione</h2>
        <p className="mt-1 font-mono text-bottle">/p/{salon.slug}</p>
        <p className="mt-2 text-sm text-ink-soft">
          La pagina pubblica arriverà nella Fase 4. Intanto l&apos;indirizzo è già riservato al tuo salone.
        </p>
      </div>

      <div className="rounded-2xl bg-mint p-6">
        <h2 className="font-semibold text-bottle-dark">Prossimo passo: servizi, collaboratori e orari</h2>
        <p className="mt-1 text-bottle-dark">
          Nella Fase 2 potrai inserirli da qui. Per vedere come funzionerà l&apos;agenda, apri la demo.
        </p>
        <Link href="/demo" className="mt-4 inline-block rounded-full bg-bottle px-5 py-2.5 font-semibold text-white hover:bg-bottle-dark">
          Apri la demo
        </Link>
      </div>
    </div>
  );
}

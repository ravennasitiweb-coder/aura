import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CopyLink } from "@/components/app/CopyLink";
import { GapsCard } from "@/components/app/GapsCard";
import { getTomorrowGaps } from "@/lib/gaps";
import { getCurrentSalon } from "@/lib/auth";
import { businessType } from "@/lib/business-types";

export const metadata: Metadata = { title: "Panoramica — SmartBooking" };

export default function OverviewPage() {
  // La parte che dipende dall'utente si carica dentro <Suspense>
  return (
    <Suspense fallback={<p className="text-ink-soft">Caricamento…</p>}>
      <Overview />
    </Suspense>
  );
}

async function Overview() {
  const { supabase, salon, role } = await getCurrentSalon();

  const [services, staff, hours, links] = await Promise.all([
    supabase.from("services").select("id", { count: "exact", head: true }).eq("salon_id", salon.id),
    supabase.from("staff").select("id", { count: "exact", head: true }).eq("salon_id", salon.id),
    supabase.from("opening_hours").select("id", { count: "exact", head: true }).eq("salon_id", salon.id),
    supabase.from("staff_services").select("staff_id", { count: "exact", head: true }).eq("salon_id", salon.id),
  ]);

  const tables = businessType(salon.business_type).tables === true;
  const steps = tables ? [
    { done: (services.count ?? 0) > 0, title: "Controlla i turni", text: "Pranzo, cena e quanto dura un tavolo.", href: "/app/servizi", detail: `${services.count ?? 0} turni` },
    { done: (staff.count ?? 0) > 0, title: "Disegna la sala", text: "Quanti tavoli, quanti posti e dove sono.", href: "/app/sala", detail: `${staff.count ?? 0} tavoli` },
    { done: (hours.count ?? 0) > 0, title: "Imposta gli orari di apertura", text: "Giorni e orari di pranzo e cena.", href: "/app/orari", detail: (hours.count ?? 0) > 0 ? "impostati" : "da impostare" },
  ] : [
    { done: (services.count ?? 0) > 0, title: "Aggiungi i tuoi servizi", text: "Nome, durata e prezzo di ciò che offri.", href: "/app/servizi", detail: `${services.count ?? 0} servizi` },
    { done: (staff.count ?? 0) > 0, title: "Aggiungi chi lavora con te", text: "Anche solo te stesso, se lavori da solo.", href: "/app/collaboratori", detail: `${staff.count ?? 0} collaboratori` },
    { done: (links.count ?? 0) > 0, title: "Indica chi fa quali servizi", text: "Così l'agenda propone l'operatore giusto.", href: "/app/collaboratori", detail: `${links.count ?? 0} abbinamenti` },
    { done: (hours.count ?? 0) > 0, title: "Imposta gli orari di apertura", text: "Giorni, orari e pausa pranzo.", href: "/app/orari", detail: (hours.count ?? 0) > 0 ? "impostati" : "da impostare" },
  ];
  const completed = steps.filter((s) => s.done).length;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-ink-soft">Benvenuto in</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">{salon.name}</h1>
      </div>

      {completed === steps.length && role === "owner" && (
        <Suspense fallback={null}>
          <Gaps />
        </Suspense>
      )}

      <section aria-labelledby="setup-title" className="rounded-2xl border border-line bg-white p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="setup-title" className="font-display text-xl font-bold">Completa la configurazione</h2>
          <p className="text-sm text-ink-soft">{completed} di {steps.length} completati</p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-paper" aria-hidden="true">
          <div className="h-full rounded-full bg-bottle transition-all" style={{ width: `${(completed / steps.length) * 100}%` }} />
        </div>
        {/* È una sequenza: i passi sono numerati */}
        <ol className="mt-6 divide-y divide-line">
          {steps.map((s, i) => (
            <li key={s.title} className="flex items-center gap-4 py-4">
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${
                  s.done ? "bg-bottle text-white" : "border-2 border-line text-ink-soft"
                }`}
                aria-label={s.done ? "Completato" : "Da fare"}
              >
                {s.done ? "✓" : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`font-semibold ${s.done ? "text-ink-soft" : ""}`}>{s.title}</p>
                <p className="text-sm text-ink-soft">{s.text}</p>
              </div>
              <Link href={s.href} className="shrink-0 rounded-full border border-line px-4 py-2 text-sm hover:border-ink">
                {s.done ? s.detail : "Inizia"}
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {completed === steps.length && (
        <Link href="/app/agenda" className="flex items-center justify-between rounded-2xl bg-bottle p-6 text-white hover:bg-bottle-dark">
          <span>
            <span className="block font-display text-xl font-bold">È tutto pronto</span>
            <span className="text-mint">Apri l&apos;agenda e inserisci i tuoi appuntamenti.</span>
          </span>
          <span className="rounded-full bg-white px-5 py-2.5 font-semibold text-bottle">Apri l&apos;agenda</span>
        </Link>
      )}

      <section className="rounded-2xl bg-mint p-6">
        <h2 className="font-semibold text-bottle-dark">La tua pagina di prenotazione</h2>
        <p className="mt-1 font-mono text-bottle">/p/{salon.slug}</p>
        <p className="mt-2 text-sm text-bottle-dark">
          {completed === steps.length
            ? "I clienti possono già prenotare da soli. Mettila nella bio di Instagram, su Google e nel messaggio automatico di WhatsApp."
            : "Completa i passi qui sopra: i clienti vedranno solo i servizi con almeno un collaboratore e gli orari di apertura impostati."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/p/${salon.slug}`} target="_blank" className="rounded-full bg-bottle px-4 py-2 text-sm font-semibold text-white hover:bg-bottle-dark">
            Apri la tua pagina
          </Link>
          <CopyLink path={`/p/${salon.slug}`} />
        </div>
      </section>
    </div>
  );
}

async function Gaps() {
  const { times, reachable } = await getTomorrowGaps();
  return <GapsCard times={times} reachable={reachable.length} />;
}

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getCurrentSalon } from "@/lib/auth";

export const metadata: Metadata = { title: "Panoramica — SmartBooking AI" };

export default function OverviewPage() {
  // La parte che dipende dall'utente si carica dentro <Suspense>
  return (
    <Suspense fallback={<p className="text-ink-soft">Caricamento…</p>}>
      <Overview />
    </Suspense>
  );
}

async function Overview() {
  const { supabase, salon } = await getCurrentSalon();

  const [services, staff, hours, links] = await Promise.all([
    supabase.from("services").select("id", { count: "exact", head: true }).eq("salon_id", salon.id),
    supabase.from("staff").select("id", { count: "exact", head: true }).eq("salon_id", salon.id),
    supabase.from("opening_hours").select("id", { count: "exact", head: true }).eq("salon_id", salon.id),
    supabase.from("staff_services").select("staff_id", { count: "exact", head: true }).eq("salon_id", salon.id),
  ]);

  const steps = [
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

      <section aria-labelledby="setup-title" className="rounded-2xl border border-line bg-white p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="setup-title" className="font-display text-xl font-bold">Completa il tuo salone</h2>
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

      <section className="rounded-2xl bg-mint p-6">
        <h2 className="font-semibold text-bottle-dark">La tua pagina di prenotazione</h2>
        <p className="mt-1 font-mono text-bottle">/p/{salon.slug}</p>
        <p className="mt-2 text-sm text-bottle-dark">
          Quando il salone è completo, prepariamo l&apos;agenda e la pagina dove i clienti prenotano da soli o con l&apos;assistente.
        </p>
      </section>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/ui";
import { addDays, nowInTimezone } from "@/lib/agenda";
import { getCurrentSalon } from "@/lib/auth";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Statistiche — SmartBooking" };

type Stats = {
  booked: number;
  completed: number;
  no_show: number;
  cancelled: number;
  online: number;
  revenue_cents: number;
  expected_cents: number;
  customers: number;
  new_customers: number;
  top_services: { name: string; count: number; revenue_cents: number | null }[];
  by_staff: { name: string; count: number; no_show: number }[];
};

const PERIODS = {
  "30": { label: "Ultimi 30 giorni" },
  mese: { label: "Questo mese" },
  "mese-scorso": { label: "Mese scorso" },
  "90": { label: "Ultimi 3 mesi" },
} as const;
type PeriodKey = keyof typeof PERIODS;

function rangeFor(period: PeriodKey, today: string): [string, string] {
  const [y, m] = today.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (period === "mese") return [`${y}-${pad(m)}-01`, today];
  if (period === "mese-scorso") {
    const py = m === 1 ? y - 1 : y;
    const pm = m === 1 ? 12 : m - 1;
    return [`${py}-${pad(pm)}-01`, addDays(`${y}-${pad(m)}-01`, -1)];
  }
  return [addDays(today, -(Number(period) - 1)), today];
}

const pct = (part: number, total: number) => (total === 0 ? "—" : `${Math.round((part / total) * 100)}%`);

export default function StatsPage({ searchParams }: PageProps<"/app/statistiche">) {
  return (
    <>
      <PageHeader title="Statistiche" description="Come sta andando: appuntamenti, incassi, assenze e clienti nuovi." />
      <Suspense fallback={<p className="text-ink-soft">Calcolo in corso…</p>}>
        <StatsView searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function StatsView({ searchParams }: { searchParams: PageProps<"/app/statistiche">["searchParams"] }) {
  const { periodo } = await searchParams;
  const period: PeriodKey = typeof periodo === "string" && periodo in PERIODS ? (periodo as PeriodKey) : "30";
  const today = nowInTimezone("Europe/Rome").date;
  const [from, to] = rangeFor(period, today);

  const { supabase, salon } = await getCurrentSalon();
  const { data, error } = await supabase.rpc("salon_stats", { p_salon_id: salon.id, p_from: from, p_to: to });
  if (error) throw new Error(error.message);
  const s = data as Stats;
  const closed = s.completed + s.no_show; // appuntamenti già "chiusi": si sa se il cliente è venuto

  const tiles = [
    { label: "Appuntamenti", value: String(s.booked), hint: `${s.online} prenotati online (${pct(s.online, s.booked)})` },
    { label: "Incassato", value: formatPrice(s.revenue_cents), hint: "Dai servizi segnati come completati" },
    { label: "Previsto", value: formatPrice(s.expected_cents), hint: "Completati più quelli ancora da fare" },
    { label: "Assenze", value: pct(s.no_show, closed), hint: `${s.no_show} clienti non si sono presentati` },
    { label: "Clienti", value: String(s.customers), hint: `${s.new_customers} nuovi` },
    { label: "Annullati", value: String(s.cancelled), hint: "Orari tornati liberi" },
  ];

  return (
    <div className="space-y-8">
      <nav aria-label="Periodo" className="flex flex-wrap gap-2">
        {(Object.keys(PERIODS) as PeriodKey[]).map((k) => (
          <Link
            key={k}
            href={`/app/statistiche?periodo=${k}`}
            aria-current={k === period ? "page" : undefined}
            className={`rounded-full border px-4 py-2 text-sm ${k === period ? "border-bottle bg-bottle text-white" : "border-line bg-white hover:border-ink"}`}
          >
            {PERIODS[k].label}
          </Link>
        ))}
      </nav>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl border border-line bg-white px-5 py-4">
            <dt className="text-sm text-ink-soft">{t.label}</dt>
            <dd className="font-display text-3xl font-bold">{t.value}</dd>
            <dd className="text-xs text-ink-soft">{t.hint}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="top-services" className="rounded-2xl border border-line bg-white p-5">
          <h2 id="top-services" className="font-semibold">Servizi più richiesti</h2>
          {s.top_services.length === 0 ? (
            <p className="mt-2 text-sm text-ink-soft">Nessun appuntamento nel periodo.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {s.top_services.map((t) => (
                <li key={t.name}>
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold">{t.name}</span>
                    <span>{t.count}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-paper" aria-hidden="true">
                    <div className="h-full rounded-full bg-bottle" style={{ width: `${(t.count / s.top_services[0].count) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="by-staff" className="rounded-2xl border border-line bg-white p-5">
          <h2 id="by-staff" className="font-semibold">Per collaboratore</h2>
          {s.by_staff.length === 0 ? (
            <p className="mt-2 text-sm text-ink-soft">Nessun appuntamento nel periodo.</p>
          ) : (
            <table className="mt-3 w-full text-sm">
              <thead className="text-left text-ink-soft">
                <tr>
                  <th scope="col" className="pb-2 font-normal">Nome</th>
                  <th scope="col" className="pb-2 text-right font-normal">Appuntamenti</th>
                  <th scope="col" className="pb-2 text-right font-normal">Assenze</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {s.by_staff.map((b) => (
                  <tr key={b.name}>
                    <td className="py-2 font-semibold">{b.name}</td>
                    <td className="py-2 text-right">{b.count}</td>
                    <td className="py-2 text-right">{b.no_show}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
      <p className="text-xs text-ink-soft">
        Le assenze si contano sugli appuntamenti segnati come &quot;completato&quot; o &quot;non si è presentato&quot;: segnali in agenda per avere numeri precisi.
      </p>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { formatDateTime, getCustomerHistory, localDay } from "@/lib/customers";
import { ForgetCustomer } from "./ForgetCustomer";

export const metadata: Metadata = { title: "Cliente — SmartBooking AI" };

const STATUS_LABEL = {
  confirmed: "Confermato",
  completed: "Completato",
  cancelled: "Annullato",
  no_show: "Non si è presentato",
} as const;

const STATUS_STYLE = {
  confirmed: "bg-mint text-bottle-dark",
  completed: "bg-paper text-ink-soft",
  cancelled: "bg-paper text-chrome line-through",
  no_show: "bg-cherry/10 text-cherry",
} as const;

export default function CustomerPage({ params }: PageProps<"/app/clienti/[key]">) {
  return (
    <Suspense fallback={<p className="text-ink-soft">Caricamento…</p>}>
      <Customer params={params} />
    </Suspense>
  );
}

async function Customer({ params }: { params: PageProps<"/app/clienti/[key]">["params"] }) {
  const { key: rawKey } = await params;
  let key = rawKey;
  try {
    key = decodeURIComponent(rawKey);
  } catch {
    // già decodificato
  }
  const { visits, canForget } = await getCustomerHistory(key);
  if (visits.length === 0) notFound();

  const latest = visits[0];
  const phone = visits.find((v) => v.customer_phone)?.customer_phone;
  const email = visits.find((v) => v.customer_email)?.customer_email;
  const completed = visits.filter((v) => v.status === "completed").length;
  const noShows = visits.filter((v) => v.status === "no_show").length;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/app/clienti" className="text-sm text-ink-soft hover:text-ink">‹ Tutti i clienti</Link>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">{latest.customer_name}</h1>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {phone && <a href={`tel:${phone}`} className="text-bottle underline">{phone}</a>}
          {email && <a href={`mailto:${email}`} className="text-bottle underline">{email}</a>}
        </div>
      </div>

      <dl className="grid max-w-lg grid-cols-3 gap-3">
        <div className="rounded-2xl border border-line bg-white px-4 py-3">
          <dt className="text-xs text-ink-soft">Appuntamenti</dt>
          <dd className="font-display text-2xl font-bold">{visits.length}</dd>
        </div>
        <div className="rounded-2xl border border-line bg-white px-4 py-3">
          <dt className="text-xs text-ink-soft">Completati</dt>
          <dd className="font-display text-2xl font-bold">{completed}</dd>
        </div>
        <div className="rounded-2xl border border-line bg-white px-4 py-3">
          <dt className="text-xs text-ink-soft">Assenze</dt>
          <dd className={`font-display text-2xl font-bold ${noShows > 0 ? "text-cherry" : ""}`}>{noShows}</dd>
        </div>
      </dl>

      <section aria-labelledby="history-title">
        <h2 id="history-title" className="mb-3 font-semibold">Storico</h2>
        <ul className="divide-y divide-line rounded-2xl border border-line bg-white">
          {visits.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <Link href={`/app/agenda?data=${localDay(v.starts_at)}`} className="font-semibold hover:underline">
                  {formatDateTime(v.starts_at)}
                </Link>
                <p className="text-sm text-ink-soft">
                  {v.service_name} con {v.staff_name}
                  {v.source === "online" && ", prenotato online"}
                </p>
                {v.notes && <p className="mt-1 text-sm">{v.notes}</p>}
              </div>
              <span className={`rounded-full px-3 py-1 text-xs ${STATUS_STYLE[v.status]}`}>{STATUS_LABEL[v.status]}</span>
            </li>
          ))}
        </ul>
      </section>

      {canForget && <ForgetCustomer customerKey={key} name={latest.customer_name} />}
    </div>
  );
}

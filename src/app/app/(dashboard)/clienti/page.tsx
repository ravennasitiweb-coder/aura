import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/ui";
import { formatDate, listCustomers } from "@/lib/customers";

export const metadata: Metadata = { title: "Clienti — SmartBooking AI" };

export default function CustomersPage({ searchParams }: PageProps<"/app/clienti">) {
  return (
    <>
      <PageHeader
        title="Clienti"
        description="Tutte le persone che hanno prenotato, con le loro visite. Lo stesso numero di telefono, con o senza +39, è sempre lo stesso cliente."
      />
      <Suspense fallback={<p className="text-ink-soft">Caricamento dei clienti…</p>}>
        <Customers searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Customers({ searchParams }: { searchParams: PageProps<"/app/clienti">["searchParams"] }) {
  const { q } = await searchParams;
  const search = typeof q === "string" ? q.trim().slice(0, 60) : "";
  const customers = await listCustomers(search);

  return (
    <div className="space-y-5">
      <form className="flex max-w-lg gap-2" role="search">
        <label htmlFor="q" className="sr-only">Cerca un cliente</label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={search}
          placeholder="Cerca per nome, telefono o email"
          className="flex-1 rounded-full border border-line bg-white px-4 py-2.5 outline-none focus:border-bottle"
        />
        <button type="submit" className="rounded-full bg-bottle px-5 py-2.5 text-sm font-semibold text-white hover:bg-bottle-dark">
          Cerca
        </button>
      </form>

      {customers.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-6 text-ink-soft">
          {search ? `Nessun cliente trovato per "${search}".` : "Ancora nessun cliente: compariranno qui appena qualcuno prenota."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line text-ink-soft">
              <tr>
                <th scope="col" className="px-4 py-3 font-normal">Cliente</th>
                <th scope="col" className="px-4 py-3 font-normal">Telefono</th>
                <th scope="col" className="px-4 py-3 text-right font-normal">Visite</th>
                <th scope="col" className="px-4 py-3 font-normal">Ultima visita</th>
                <th scope="col" className="px-4 py-3 font-normal">Prossimo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {customers.map((c) => (
                <tr key={c.customer_key} className="hover:bg-paper">
                  <td className="px-4 py-3">
                    <Link href={`/app/clienti/${encodeURIComponent(c.customer_key)}`} className="font-semibold text-bottle hover:underline">
                      {c.name}
                    </Link>
                    {c.no_shows > 0 && (
                      <span className="ml-2 rounded-full bg-cherry/10 px-2 py-0.5 text-xs text-cherry">
                        {c.no_shows === 1 ? "1 assenza" : `${c.no_shows} assenze`}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">{c.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-right">{c.visits}</td>
                  <td className="px-4 py-3">{c.last_visit ? formatDate(c.last_visit) : "—"}</td>
                  <td className="px-4 py-3">{c.next_appointment ? formatDate(c.next_appointment) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-ink-soft">&quot;Visite&quot; conta gli appuntamenti segnati come completati in agenda.</p>
    </div>
  );
}

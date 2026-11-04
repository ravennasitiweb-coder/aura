import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/ui";
import { getCurrentSalon } from "@/lib/auth";
import { NewServiceForm, ServiceRow, type ServiceItem } from "./ServiceForms";

export const metadata: Metadata = { title: "Servizi — SmartBooking AI" };

export default function ServicesPage() {
  return (
    <>
      <PageHeader
        title="Servizi"
        description="Ciò che i clienti possono prenotare. La durata serve all'agenda per sapere quanto tempo bloccare."
      />
      <Suspense fallback={<p className="text-ink-soft">Caricamento dei servizi…</p>}>
        <ServicesList />
      </Suspense>
    </>
  );
}

async function ServicesList() {
  const { supabase, salon, role } = await getCurrentSalon();
  const { data, error } = await supabase
    .from("services")
    .select("id, name, duration_min, price_cents, active")
    .eq("salon_id", salon.id)
    .order("created_at");
  if (error) throw new Error(error.message);
  const services = (data ?? []) as ServiceItem[];
  const canEdit = role === "owner";

  return (
    <div className="space-y-8">
      {canEdit && <NewServiceForm />}

      <section aria-labelledby="list-title">
        <h2 id="list-title" className="mb-3 font-semibold">I tuoi servizi ({services.length})</h2>
        {services.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line p-6 text-ink-soft">
            Non hai ancora servizi. Aggiungi il primo qui sopra, per esempio &quot;Taglio uomo, 30 minuti, 20 €&quot;.
          </p>
        ) : (
          <ul className="space-y-3">
            {services.map((s) => (
              <li key={s.id}>
                <ServiceRow service={s} canEdit={canEdit} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

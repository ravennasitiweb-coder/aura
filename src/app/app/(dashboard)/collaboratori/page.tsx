import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/ui";
import { getCurrentSalon } from "@/lib/auth";
import { NewStaffForm, StaffRow, type StaffItem } from "./StaffForms";

export const metadata: Metadata = { title: "Collaboratori — SmartBooking" };

export default function StaffPage() {
  return (
    <>
      <PageHeader
        title="Collaboratori"
        description="Le persone che ricevono appuntamenti. Per ognuna scegli i servizi che sa fare: l'agenda proporrà solo abbinamenti possibili."
      />
      <Suspense fallback={<p className="text-ink-soft">Caricamento dei collaboratori…</p>}>
        <StaffList />
      </Suspense>
    </>
  );
}

async function StaffList() {
  const { supabase, salon, role } = await getCurrentSalon();
  const [staffRes, servicesRes, linksRes] = await Promise.all([
    supabase.from("staff").select("id, name, role_title, active").eq("salon_id", salon.id).order("created_at"),
    supabase.from("services").select("id, name").eq("salon_id", salon.id).order("created_at"),
    supabase.from("staff_services").select("staff_id, service_id").eq("salon_id", salon.id),
  ]);
  if (staffRes.error || servicesRes.error || linksRes.error) throw new Error("Impossibile leggere i collaboratori");

  const services = servicesRes.data ?? [];
  const staff: StaffItem[] = (staffRes.data ?? []).map((s) => ({
    ...s,
    serviceIds: (linksRes.data ?? []).filter((l) => l.staff_id === s.id).map((l) => l.service_id),
  }));
  const canEdit = role === "owner";

  return (
    <div className="space-y-8">
      {canEdit && <NewStaffForm />}

      {services.length === 0 && staff.length > 0 && (
        <p className="rounded-xl bg-paper px-4 py-3 text-sm text-ink-soft">
          Per indicare chi fa cosa, prima{" "}
          <Link href="/app/servizi" className="font-semibold text-bottle underline">aggiungi i servizi</Link>.
        </p>
      )}

      <section aria-labelledby="list-title">
        <h2 id="list-title" className="mb-3 font-semibold">Il tuo team ({staff.length})</h2>
        {staff.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line p-6 text-ink-soft">
            Nessun collaboratore. Se lavori da solo, aggiungi te stesso: serve all&apos;agenda.
          </p>
        ) : (
          <ul className="space-y-3">
            {staff.map((s) => (
              <li key={s.id}>
                <StaffRow member={s} services={services} canEdit={canEdit} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

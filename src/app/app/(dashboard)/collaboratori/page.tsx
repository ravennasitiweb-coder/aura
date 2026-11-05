import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/ui";
import { getCurrentSalon } from "@/lib/auth";
import { StaffExtras, type StaffExtrasData } from "./StaffExtras";
import { NewStaffForm, StaffRow, type StaffItem } from "./StaffForms";

const offFormat = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });

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
  const canEdit = role === "owner";
  const [staffRes, servicesRes, linksRes, hoursRes, offRes, invitesRes] = await Promise.all([
    supabase.from("staff").select("id, name, role_title, active, user_id, calendar_token").eq("salon_id", salon.id).order("created_at"),
    supabase.from("services").select("id, name").eq("salon_id", salon.id).order("created_at"),
    supabase.from("staff_services").select("staff_id, service_id").eq("salon_id", salon.id),
    supabase.from("staff_hours").select("staff_id, weekday, opens_at, closes_at").eq("salon_id", salon.id),
    supabase.from("staff_time_off").select("id, staff_id, starts_at, ends_at, reason").eq("salon_id", salon.id).gt("ends_at", new Date().toISOString()).order("starts_at"),
    // Gli inviti li vede solo il titolare (RLS): per gli altri la lista è vuota
    canEdit ? supabase.from("salon_invites").select("id, staff_id, email, accepted_at").eq("salon_id", salon.id) : Promise.resolve({ data: [], error: null }),
  ]);
  for (const r of [staffRes, servicesRes, linksRes, hoursRes, offRes, invitesRes]) {
    if (r.error) throw new Error("Impossibile leggere i collaboratori");
  }

  const services = servicesRes.data ?? [];
  const staff: StaffItem[] = (staffRes.data ?? []).map((s) => ({
    ...s,
    serviceIds: (linksRes.data ?? []).filter((l) => l.staff_id === s.id).map((l) => l.service_id),
  }));
  const extras = (id: string, name: string, userId: string | null, calendarToken: string): StaffExtrasData => ({
    staffId: id,
    staffName: name,
    hours: (hoursRes.data ?? []).filter((h) => h.staff_id === id),
    timeOff: (offRes.data ?? [])
      .filter((o) => o.staff_id === id)
      .map((o) => ({ id: o.id, label: `${offFormat.format(new Date(o.starts_at))} – ${offFormat.format(new Date(o.ends_at))}`, reason: o.reason })),
    invites: (invitesRes.data ?? []).filter((i) => i.staff_id === id).map((i) => ({ id: i.id, email: i.email, accepted: Boolean(i.accepted_at) })),
    hasAccount: Boolean(userId),
    calendarPath: `/api/calendario/${calendarToken}`,
  });

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
                {canEdit && <StaffExtras data={extras(s.id, s.name, s.user_id, s.calendar_token)} />}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

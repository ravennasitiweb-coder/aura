import "server-only";
import { getCurrentSalon } from "@/lib/auth";
import { computeFreeSlots, isoWeekday, nowInTimezone, timeToMinutes, type TimeRange } from "@/lib/agenda";

// Letture dal database per l'agenda. Il salone viene sempre dalla sessione.

export type AgendaAppointment = {
  id: string;
  staff_id: string;
  service_id: string;
  service_name: string;
  customer_name: string;
  customer_phone: string | null;
  notes: string | null;
  status: "confirmed" | "completed" | "cancelled" | "no_show";
  source: "manual" | "online" | "chatbot";
  start_min: number;
  end_min: number;
};

export async function getAgendaDay(date: string) {
  const { supabase, salon } = await getCurrentSalon();
  const weekday = isoWeekday(date);

  const [appointments, staff, services, links, hours] = await Promise.all([
    supabase.rpc("agenda_day", { p_salon_id: salon.id, p_date: date }),
    supabase.from("staff").select("id, name, role_title, active").eq("salon_id", salon.id).order("created_at"),
    supabase.from("services").select("id, name, duration_min, active").eq("salon_id", salon.id).order("created_at"),
    supabase.from("staff_services").select("staff_id, service_id").eq("salon_id", salon.id),
    supabase.from("opening_hours").select("opens_at, closes_at").eq("salon_id", salon.id).eq("weekday", weekday).order("opens_at"),
  ]);
  for (const r of [appointments, staff, services, links, hours]) {
    if (r.error) throw new Error(`Impossibile leggere l'agenda: ${r.error.message}`);
  }

  const openRanges: TimeRange[] = (hours.data ?? []).map((h) => ({
    start: timeToMinutes(h.opens_at),
    end: timeToMinutes(h.closes_at),
  }));

  return {
    salon,
    appointments: (appointments.data ?? []) as AgendaAppointment[],
    staff: staff.data ?? [],
    services: services.data ?? [],
    links: links.data ?? [],
    openRanges,
  };
}

export async function getFreeSlotsFor(date: string, serviceId: string, staffId: string | null) {
  const day = await getAgendaDay(date);
  const service = day.services.find((s) => s.id === serviceId && s.active);
  if (!service) return [];

  const capable = new Set(day.links.filter((l) => l.service_id === serviceId).map((l) => l.staff_id));
  const staffIds = day.staff
    .filter((s) => s.active && capable.has(s.id) && (!staffId || s.id === staffId))
    .map((s) => s.id);

  const now = nowInTimezone("Europe/Rome");
  if (date < now.date) return [];

  return computeFreeSlots({
    openRanges: day.openRanges,
    staffIds,
    busy: day.appointments
      .filter((a) => a.status !== "cancelled")
      .map((a) => ({ staffId: a.staff_id, start: a.start_min, end: a.end_min })),
    durationMin: service.duration_min,
    notBeforeMin: date === now.date ? now.minutes : 0,
  });
}

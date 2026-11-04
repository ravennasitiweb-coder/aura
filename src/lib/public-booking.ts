import "server-only";
import { cache } from "react";
import { addDays, computeFreeSlots, isValidDate, nowInTimezone, type BusyBlock, type FreeSlot, type TimeRange } from "@/lib/agenda";
import { createClient } from "@/lib/supabase/server";

// Letture per la pagina pubblica. Usano solo le funzioni "public_*"
// del database, le uniche accessibili ai visitatori.

export type PublicService = { id: string; name: string; duration_min: number; price_cents: number };
export type PublicStaff = { id: string; name: string; service_ids: string[] };
export type PublicSalonInfo = {
  salon: { name: string; city: string | null; slug: string };
  services: PublicService[];
  staff: PublicStaff[];
  open_weekdays: number[];
};

export const BOOKING_WINDOW_DAYS = 90;
// Non si prenota a meno di 15 minuti dall'inizio (stessa regola del database)
const MIN_NOTICE_MIN = 15;
const TIMEZONE = "Europe/Rome";

export const getPublicSalon = cache(async (slug: string): Promise<PublicSalonInfo | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_salon_info", { p_slug: slug });
  if (error) throw new Error(`Impossibile leggere il salone: ${error.message}`);
  return (data as PublicSalonInfo | null) ?? null;
});

export async function getPublicFreeSlots(slug: string, serviceId: string, date: string, staffId: string | null): Promise<FreeSlot[]> {
  const info = await getPublicSalon(slug);
  if (!info || !isValidDate(date)) return [];

  const now = nowInTimezone(TIMEZONE);
  if (date < now.date || date > addDays(now.date, BOOKING_WINDOW_DAYS)) return [];

  const service = info.services.find((s) => s.id === serviceId);
  if (!service) return [];
  const staffIds = info.staff
    .filter((s) => s.service_ids.includes(serviceId) && (!staffId || s.id === staffId))
    .map((s) => s.id);
  if (staffIds.length === 0) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_day", { p_slug: slug, p_date: date });
  if (error || !data) return [];
  const day = data as { open_ranges: TimeRange[]; busy: { staff_id: string; start: number; end: number }[] };

  return computeFreeSlots({
    openRanges: day.open_ranges,
    staffIds,
    busy: day.busy.map((b): BusyBlock => ({ staffId: b.staff_id, start: b.start, end: b.end })),
    durationMin: service.duration_min,
    notBeforeMin: date === now.date ? now.minutes + MIN_NOTICE_MIN : 0,
  });
}

export function publicToday() {
  return nowInTimezone(TIMEZONE).date;
}

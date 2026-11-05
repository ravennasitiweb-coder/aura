import "server-only";
import { addDays, computeFreeSlots, minutesToTime, nowInTimezone } from "@/lib/agenda";
import { busyBlocks, getAgendaDay } from "@/lib/agenda-data";
import { getCurrentSalon } from "@/lib/auth";
import { audienceFor, recentlyMessaged } from "@/lib/marketing";

// "Riempi i buchi": orari ancora liberi domani e clienti che si possono avvisare.

export const GAPS_KIND = "gaps";
export const GAPS_COOLDOWN_DAYS = 7;

export async function getTomorrowGaps() {
  const { supabase, salon } = await getCurrentSalon();
  const date = addDays(nowInTimezone("Europe/Rome").date, 1);
  const day = await getAgendaDay(date);

  // Orari liberi per il servizio più breve: se c'è posto per quello, c'è un buco
  const services = day.services.filter((s) => s.active).sort((a, b) => a.duration_min - b.duration_min);
  const shortest = services[0];
  let times: string[] = [];
  if (shortest) {
    const capable = new Set(day.links.filter((l) => l.service_id === shortest.id).map((l) => l.staff_id));
    const staffIds = day.staff.filter((s) => s.active && capable.has(s.id)).map((s) => s.id);
    const slots = computeFreeSlots({
      openRanges: day.openRanges,
      staffRanges: day.staffRanges,
      staffIds,
      busy: busyBlocks(day),
      durationMin: shortest.duration_min,
    });
    // Un orario ogni ora al massimo, per non elencare 9:00, 9:15, 9:30...
    const hourly = new Map<number, number>();
    for (const s of slots) if (!hourly.has(Math.floor(s.start / 60))) hourly.set(Math.floor(s.start / 60), s.start);
    times = [...hourly.values()].sort((a, b) => a - b).map(minutesToTime);
  }

  const audience = await audienceFor(supabase, salon.id);
  const recent = await recentlyMessaged(supabase, salon.id, GAPS_KIND, GAPS_COOLDOWN_DAYS);
  const reachable = audience.filter((c) => !recent.has(c.customer_key));

  return { salon, date, times, reachable };
}

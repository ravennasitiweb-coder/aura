import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Calendario personale di un collaboratore in formato .ics, da aggiungere a
// Google Calendar o al calendario dell'iPhone come "abbonamento".
// Chi ha il link vede gli appuntamenti: il codice è lungo e casuale, ed è
// visibile solo al titolare nella pagina Collaboratori.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
// Testo nel formato iCalendar: niente a capo, virgole e punti e virgola protetti
const esc = (s: string) => s.replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\r?\n/g, " ");

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/calendario/[token]">) {
  const { token } = await ctx.params;
  if (!UUID_RE.test(token) || !process.env.SUPABASE_SECRET_KEY) return new Response("Non trovato", { status: 404 });

  const admin = createAdminClient();
  const { data: staff } = await admin
    .from("staff")
    .select("id, name, salon_id, salons (name)")
    .eq("calendar_token", token)
    .maybeSingle();
  if (!staff) return new Response("Non trovato", { status: 404 });
  const salonName = (staff.salons as unknown as { name: string }).name;

  // Dal mese scorso ai prossimi 3 mesi
  const from = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const to = new Date(Date.now() + 90 * 86_400_000).toISOString();
  const { data: appts } = await admin
    .from("appointments")
    .select("id, starts_at, ends_at, customer_name, customer_phone, status, services (name)")
    .eq("staff_id", staff.id)
    .in("status", ["confirmed", "completed"])
    .gte("starts_at", from)
    .lte("starts_at", to)
    .order("starts_at");

  const events = (appts ?? []).map((a) => {
    const service = (a.services as unknown as { name: string }).name;
    return [
      "BEGIN:VEVENT",
      `UID:${a.id}@smartbooking`,
      `DTSTAMP:${stamp(new Date().toISOString())}`,
      `DTSTART:${stamp(a.starts_at)}`,
      `DTEND:${stamp(a.ends_at)}`,
      `SUMMARY:${esc(`${a.customer_name}: ${service}`)}`,
      `DESCRIPTION:${esc(a.customer_phone ? `Tel. ${a.customer_phone}` : salonName)}`,
      "END:VEVENT",
    ].join("\r\n");
  });

  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SmartBooking//IT",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${esc(`${salonName}, ${staff.name}`)}`,
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "private, max-age=300",
    },
  });
}

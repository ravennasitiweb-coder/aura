import "server-only";
import { SITE_URL, sendEmail, waitlistEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_NOTIFIED = 5;
const dayLabel = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/**
 * Si è liberato un orario: avvisa per email chi è in lista d'attesa per quel
 * giorno e quel servizio (al massimo 5 persone, ognuna una sola volta).
 * Gira sul server con la chiave segreta: va chiamata solo dopo un
 * annullamento o uno spostamento riusciti.
 * `freedStartsAt`: dopo uno spostamento, l'orario che si è liberato
 * (quello vecchio); dopo un annullamento non serve.
 */
export async function notifyWaitlistForAppointment(appointmentId: string, freedStartsAt?: string) {
  if (!process.env.SUPABASE_SECRET_KEY) return;
  try {
    const admin = createAdminClient();
    const { data: appt } = await admin
      .from("appointments")
      .select("salon_id, service_id, staff_id, starts_at, salons (slug, name, timezone), services (name)")
      .eq("id", appointmentId)
      .maybeSingle();
    if (!appt) return;
    const salon = appt.salons as unknown as { slug: string; name: string; timezone: string };
    const service = appt.services as unknown as { name: string };
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: salon.timezone }).format(new Date(freedStartsAt ?? appt.starts_at));

    const { data: entries } = await admin
      .from("waitlist")
      .select("id, customer_name, customer_email, staff_id")
      .eq("salon_id", appt.salon_id)
      .eq("service_id", appt.service_id)
      .eq("day", day)
      .is("notified_at", null)
      .order("created_at")
      .limit(20);

    const eligible = (entries ?? []).filter((e) => !e.staff_id || e.staff_id === appt.staff_id).slice(0, MAX_NOTIFIED);
    for (const e of eligible) {
      const m = waitlistEmail({
        customerName: e.customer_name,
        salonName: salon.name,
        serviceName: service.name,
        day: dayLabel.format(new Date(`${day}T12:00:00Z`)),
        bookUrl: `${SITE_URL}/p/${salon.slug}`,
      });
      if (await sendEmail(e.customer_email, m.subject, m.html, m.text)) {
        await admin.from("waitlist").update({ notified_at: new Date().toISOString() }).eq("id", e.id);
      }
    }
  } catch (err) {
    console.error("Avviso lista d'attesa non riuscito", err);
  }
}

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, minutesToTime, nowInTimezone, zonedMidnightUtc } from "@/lib/agenda";
import { SITE_URL, dailySummaryEmail, recallEmail, reminderEmail, reviewEmail, sendEmail } from "@/lib/email";
import { MAX_PROMO_PER_RUN, audienceFor, sendOnce } from "@/lib/marketing";

// Attività automatica giornaliera (vedi /api/cron/giornaliero).
// Ogni messaggio parte una sola volta: i promemoria sono "prenotati" sul
// singolo appuntamento, gli altri messaggi passano dal registro message_log.

type SalonRow = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  reminders_enabled: boolean;
  daily_summary: boolean;
  recall_days: number | null;
  google_review_url: string | null;
};

export type TaskReport = { salons: number; reminders: number; summaries: number; reviews: number; recalls: number; errors: number };

const dayLabel = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const label = (date: string) => dayLabel.format(new Date(`${date}T12:00:00Z`));

export async function runDailyTasks(admin: SupabaseClient): Promise<TaskReport> {
  const report: TaskReport = { salons: 0, reminders: 0, summaries: 0, reviews: 0, recalls: 0, errors: 0 };
  const { data: salons, error } = await admin
    .from("salons")
    .select("id, name, slug, timezone, reminders_enabled, daily_summary, recall_days, google_review_url");
  if (error) throw new Error(error.message);

  for (const salon of (salons ?? []) as SalonRow[]) {
    report.salons++;
    // Un problema con un'attività non deve fermare le altre
    for (const task of [reminders, summary, reviews, recalls] as const) {
      try {
        report[task.key] += await task.run(admin, salon);
      } catch (err) {
        report.errors++;
        console.error(`Attività "${task.key}" non riuscita per ${salon.id}`, err);
      }
    }
  }
  return report;
}

// 1. Promemoria per gli appuntamenti di domani ---------------------------------

const reminders = {
  key: "reminders" as const,
  async run(admin: SupabaseClient, salon: SalonRow) {
    if (!salon.reminders_enabled) return 0;
    const tomorrow = addDays(nowInTimezone(salon.timezone).date, 1);
    const from = zonedMidnightUtc(tomorrow, salon.timezone).toISOString();
    const to = zonedMidnightUtc(addDays(tomorrow, 1), salon.timezone).toISOString();

    const { data } = await admin
      .from("appointments")
      .select("id, customer_name, customer_email, starts_at, manage_token, services (name), staff (name)")
      .eq("salon_id", salon.id)
      .eq("status", "confirmed")
      .is("reminder_sent_at", null)
      .not("customer_email", "is", null)
      .gte("starts_at", from)
      .lt("starts_at", to);

    let sent = 0;
    for (const a of data ?? []) {
      // Si "prenota" il promemoria: se un'altra esecuzione l'ha già preso, si salta
      const { data: claimed } = await admin
        .from("appointments")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", a.id)
        .is("reminder_sent_at", null)
        .select("id")
        .maybeSingle();
      if (!claimed) continue;

      const m = reminderEmail({
        customerName: a.customer_name,
        salonName: salon.name,
        serviceName: (a.services as unknown as { name: string }).name,
        staffName: (a.staff as unknown as { name: string }).name,
        startsAt: a.starts_at,
        token: a.manage_token,
      });
      if (await sendEmail(a.customer_email!, m.subject, m.html, m.text)) sent++;
      else await admin.from("appointments").update({ reminder_sent_at: null }).eq("id", a.id); // riproverà domani
    }
    return sent;
  },
};

// 2. Riepilogo della giornata al titolare --------------------------------------

const summary = {
  key: "summaries" as const,
  async run(admin: SupabaseClient, salon: SalonRow) {
    if (!salon.daily_summary) return 0;
    const today = nowInTimezone(salon.timezone).date;
    const from = zonedMidnightUtc(today, salon.timezone).toISOString();
    const to = zonedMidnightUtc(addDays(today, 1), salon.timezone).toISOString();

    const [{ data: appts }, { data: owners }] = await Promise.all([
      admin
        .from("appointments")
        .select("starts_at, customer_name, services (name), staff (name)")
        .eq("salon_id", salon.id)
        .eq("status", "confirmed")
        .gte("starts_at", from)
        .lt("starts_at", to)
        .order("starts_at"),
      admin.from("salon_members").select("user_id").eq("salon_id", salon.id).eq("role", "owner"),
    ]);

    const rows = (appts ?? []).map((a) => {
      const local = nowInTimezone(salon.timezone, new Date(a.starts_at));
      return {
        time: minutesToTime(local.minutes),
        customer: a.customer_name,
        service: (a.services as unknown as { name: string }).name,
        staff: (a.staff as unknown as { name: string }).name,
      };
    });

    let sent = 0;
    for (const o of owners ?? []) {
      const { data: user } = await admin.auth.admin.getUserById(o.user_id);
      const email = user.user?.email;
      if (!email) continue;
      if (await sendOnce({ salonId: salon.id, kind: "summary", ref: `${o.user_id}|${today}`, to: email, email: dailySummaryEmail({ salonName: salon.name, dayLabel: label(today), rows }) }, admin)) {
        sent++;
      }
    }
    return sent;
  },
};

// 3. Richiesta di recensione a chi è venuto ieri -------------------------------

const reviews = {
  key: "reviews" as const,
  async run(admin: SupabaseClient, salon: SalonRow) {
    if (!salon.google_review_url) return 0;
    const yesterday = addDays(nowInTimezone(salon.timezone).date, -1);
    const { data, error } = await admin.rpc("review_candidates", { p_salon_id: salon.id, p_day: yesterday });
    if (error) throw new Error(error.message);

    let sent = 0;
    for (const c of ((data ?? []) as { appointment_id: string; customer_name: string; customer_email: string; token: string }[]).slice(0, MAX_PROMO_PER_RUN)) {
      const ok = await sendOnce(
        {
          salonId: salon.id,
          kind: "review",
          ref: c.appointment_id,
          to: c.customer_email,
          email: reviewEmail({ customerName: c.customer_name, salonName: salon.name, reviewUrl: salon.google_review_url, token: c.token }),
        },
        admin,
      );
      if (ok) sent++;
    }
    return sent;
  },
};

// 4. Richiamo dei clienti che non tornano --------------------------------------

const recalls = {
  key: "recalls" as const,
  async run(admin: SupabaseClient, salon: SalonRow) {
    if (!salon.recall_days) return 0;
    const target = addDays(nowInTimezone(salon.timezone).date, -salon.recall_days);
    const audience = await audienceFor(admin, salon.id);
    // Clienti la cui ultima visita è esattamente "recall_days" giorni fa
    const due = audience.filter((c) => nowInTimezone(salon.timezone, new Date(c.last_visit)).date === target);

    let sent = 0;
    for (const c of due.slice(0, MAX_PROMO_PER_RUN)) {
      const ok = await sendOnce(
        {
          salonId: salon.id,
          kind: "recall",
          ref: `${c.customer_key}|${target}`,
          to: c.customer_email,
          email: recallEmail({
            customerName: c.customer_name,
            salonName: salon.name,
            bookUrl: `${SITE_URL}/p/${salon.slug}`,
            token: c.token,
            weeks: Math.round(salon.recall_days / 7),
          }),
        },
        admin,
      );
      if (ok) sent++;
    }
    return sent;
  },
};

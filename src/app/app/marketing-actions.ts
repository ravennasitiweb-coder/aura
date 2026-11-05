"use server";

import { refresh } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { SITE_URL, emailEnabled, gapsEmail } from "@/lib/email";
import { GAPS_KIND, getTomorrowGaps } from "@/lib/gaps";
import { MAX_PROMO_PER_RUN, sendOnce } from "@/lib/marketing";
import type { ActionState } from "./actions";

const dayLabel = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

// "Riempi i buchi": avvisa i clienti abituali che domani ci sono posti liberi.
// Solo chi ha dato il consenso, al massimo una volta alla settimana.
export async function fillTomorrowGaps(): Promise<ActionState> {
  await requireOwner();
  if (!emailEnabled() || !process.env.SUPABASE_SECRET_KEY) return { error: "L'invio delle email non è attivo." };

  const { salon, date, times, reachable } = await getTomorrowGaps();
  if (times.length === 0) return { error: "Domani non ci sono orari liberi: niente da riempire!" };
  if (reachable.length === 0) return { error: "Nessun cliente da avvisare (servono consenso ed email, e non averli già avvisati questa settimana)." };

  const label = `domani, ${dayLabel.format(new Date(`${date}T12:00:00Z`))}`;
  let sent = 0;
  for (const c of reachable.slice(0, MAX_PROMO_PER_RUN)) {
    const ok = await sendOnce({
      salonId: salon.id,
      kind: GAPS_KIND,
      ref: `${c.customer_key}|${date}`,
      to: c.customer_email,
      email: gapsEmail({
        customerName: c.customer_name,
        salonName: salon.name,
        dayLabel: label,
        times: times.slice(0, 4),
        bookUrl: `${SITE_URL}/p/${salon.slug}`,
        token: c.token,
      }),
    });
    if (ok) sent++;
  }

  refresh();
  return sent > 0 ? { ok: `Fatto: ${sent} clienti avvisati dei posti liberi di domani.` } : { error: "Nessuna email inviata. Riprova più tardi." };
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { addDays, nowInTimezone } from "@/lib/agenda";
import { getCurrentSalon } from "@/lib/auth";
import { listCustomers } from "@/lib/customers";
import { freeTimesOn } from "@/lib/gaps";
import { FillGaps } from "./FillGaps";

export const metadata: Metadata = { title: "Riempi i buchi — SmartBooking" };

const LAPSED_DAYS = 35;

export default function FillGapsPage() {
  return (
    <Suspense fallback={<p className="text-ink-soft">Caricamento…</p>}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const { salon } = await getCurrentSalon();
  const today = nowInTimezone("Europe/Rome").date;
  const tomorrow = addDays(today, 1);
  const [todayTimes, tomorrowTimes, customers] = await Promise.all([freeTimesOn(today), freeTimesOn(tomorrow), listCustomers("")]);

  // Clienti con telefono che non vengono da un po' e non hanno già un appuntamento
  const cutoff = Date.now() - LAPSED_DAYS * 86_400_000;
  const lapsed = customers
    .filter((c) => c.phone && !c.next_appointment && c.last_visit && new Date(c.last_visit).getTime() < cutoff)
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 40)
    .map((c) => ({ key: c.customer_key, name: c.name, phone: c.phone!, lastVisit: c.last_visit! }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Riempi i buchi</h1>
        <p className="mt-1 text-ink-soft">Un posto vuoto è un incasso perso. Avvisa chi non viene da un po&apos; o pubblica i posti liberi su Instagram.</p>
      </div>
      <FillGaps salonName={salon.name} slug={salon.slug} days={{ oggi: todayTimes, domani: tomorrowTimes }} lapsed={lapsed} />
    </div>
  );
}

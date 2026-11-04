import type { Metadata } from "next";
import { Suspense } from "react";
import { isValidDate, nowInTimezone } from "@/lib/agenda";
import { getAgendaDay } from "@/lib/agenda-data";
import { AgendaBoard } from "./AgendaBoard";

export const metadata: Metadata = { title: "Agenda — SmartBooking AI" };

export default function AgendaPage({ searchParams }: PageProps<"/app/agenda">) {
  return (
    <Suspense fallback={<p className="text-ink-soft">Caricamento dell&apos;agenda…</p>}>
      <Agenda searchParams={searchParams} />
    </Suspense>
  );
}

async function Agenda({ searchParams }: { searchParams: PageProps<"/app/agenda">["searchParams"] }) {
  const { data } = await searchParams;
  const today = nowInTimezone("Europe/Rome").date;
  // Il giorno arriva dall'indirizzo (?data=2026-11-04); se manca o non è valido, oggi
  const date = typeof data === "string" && isValidDate(data) ? data : today;
  const day = await getAgendaDay(date);

  return (
    <AgendaBoard
      date={date}
      today={today}
      appointments={day.appointments}
      staff={day.staff}
      services={day.services}
      links={day.links}
      openRanges={day.openRanges}
    />
  );
}

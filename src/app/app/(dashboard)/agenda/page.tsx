import type { Metadata } from "next";
import { Suspense } from "react";
import { isValidDate, nowInTimezone, startOfWeek } from "@/lib/agenda";
import { getAgendaDay, getAgendaWeek } from "@/lib/agenda-data";
import { AgendaBoard } from "./AgendaBoard";
import { WeekBoard } from "./WeekBoard";

export const metadata: Metadata = { title: "Agenda — SmartBooking" };

export default function AgendaPage({ searchParams }: PageProps<"/app/agenda">) {
  return (
    <Suspense fallback={<p className="text-ink-soft">Caricamento dell&apos;agenda…</p>}>
      <Agenda searchParams={searchParams} />
    </Suspense>
  );
}

async function Agenda({ searchParams }: { searchParams: PageProps<"/app/agenda">["searchParams"] }) {
  const { data, vista } = await searchParams;
  const today = nowInTimezone("Europe/Rome").date;
  // Il giorno arriva dall'indirizzo (?data=2026-11-04); se manca o non è valido, oggi
  const date = typeof data === "string" && isValidDate(data) ? data : today;

  if (vista === "settimana") {
    const monday = startOfWeek(date);
    const week = await getAgendaWeek(monday);
    return <WeekBoard monday={monday} today={today} {...week} />;
  }

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

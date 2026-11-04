import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/app/ui";
import { getCurrentSalon } from "@/lib/auth";
import { shortTime } from "@/lib/format";
import { HoursForm, type DayHours } from "./HoursForm";

export const metadata: Metadata = { title: "Orari di apertura — SmartBooking" };

// Proposta iniziale tipica di un salone italiano: chiuso domenica e lunedì,
// pausa pranzo 13–15. Viene salvata solo quando premi "Salva orari".
const SUGGESTED: DayHours[] = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
  weekday,
  open: weekday >= 2 && weekday <= 6,
  s1: "09:00",
  e1: "13:00",
  split: true,
  s2: "15:00",
  e2: "19:00",
}));

export default function HoursPage() {
  return (
    <>
      <PageHeader
        title="Orari di apertura"
        description="Quando il salone accetta appuntamenti. Se fai orario continuato, togli la spunta alla pausa."
      />
      <Suspense fallback={<p className="text-ink-soft">Caricamento degli orari…</p>}>
        <Hours />
      </Suspense>
    </>
  );
}

async function Hours() {
  const { supabase, salon, role } = await getCurrentSalon();
  const { data, error } = await supabase
    .from("opening_hours")
    .select("weekday, opens_at, closes_at")
    .eq("salon_id", salon.id)
    .order("weekday")
    .order("opens_at");
  if (error) throw new Error(error.message);

  const saved = data ?? [];
  const days: DayHours[] =
    saved.length === 0
      ? SUGGESTED
      : [1, 2, 3, 4, 5, 6, 7].map((weekday) => {
          const ranges = saved.filter((h) => h.weekday === weekday);
          return {
            weekday,
            open: ranges.length > 0,
            s1: ranges[0] ? shortTime(ranges[0].opens_at) : "09:00",
            e1: ranges[0] ? shortTime(ranges[0].closes_at) : "19:00",
            split: ranges.length > 1,
            s2: ranges[1] ? shortTime(ranges[1].opens_at) : "15:00",
            e2: ranges[1] ? shortTime(ranges[1].closes_at) : "19:00",
          };
        });

  return <HoursForm days={days} isSuggestion={saved.length === 0} canEdit={role === "owner"} />;
}

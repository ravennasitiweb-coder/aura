import Link from "next/link";

// Selettore "Giorno / Settimana" dell'agenda
export function ViewSwitch({ view, date }: { view: "giorno" | "settimana"; date: string }) {
  const base = "px-4 py-2 text-sm";
  return (
    <div className="flex overflow-hidden rounded-full border border-line bg-white" role="group" aria-label="Vista">
      <Link href={`/app/agenda?data=${date}`} aria-current={view === "giorno" ? "page" : undefined} className={`${base} ${view === "giorno" ? "bg-bottle text-white" : "hover:bg-paper"}`}>
        Giorno
      </Link>
      <Link href={`/app/agenda?vista=settimana&data=${date}`} aria-current={view === "settimana" ? "page" : undefined} className={`${base} ${view === "settimana" ? "bg-bottle text-white" : "hover:bg-paper"}`}>
        Settimana
      </Link>
    </div>
  );
}

import { SALON, STAFF, formatTime, serviceById, type Appointment } from "@/lib/demo-data";

const PX_PER_MIN = 1.4;

const SOURCE_STYLE: Record<Appointment["source"], string> = {
  manuale: "bg-white border border-line",
  online: "bg-mint border border-mint-deep",
  chatbot: "bg-white border border-line border-l-4 border-l-bottle",
};

const SOURCE_LABEL: Record<Appointment["source"], string> = {
  manuale: "Inserito in salone",
  online: "Prenotato online",
  chatbot: "Prenotato dall'assistente",
};

export function AgendaGrid({ appointments, highlightId }: { appointments: Appointment[]; highlightId?: string }) {
  const hours: number[] = [];
  for (let m = SALON.openMin; m <= SALON.closeMin; m += 60) hours.push(m);
  const height = (SALON.closeMin - SALON.openMin) * PX_PER_MIN;

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-white">
      <div className="min-w-[560px]">
        {/* Intestazione colonne */}
        <div className="grid grid-cols-[56px_repeat(3,1fr)] border-b border-line">
          <div />
          {STAFF.map((s) => (
            <div key={s.id} className="border-l border-line px-3 py-3">
              <p className="font-semibold">{s.name}</p>
              <p className="text-xs text-ink-soft">{s.role}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-[56px_repeat(3,1fr)]">
          {/* Orari */}
          <div className="relative" style={{ height }}>
            {hours.map((m) => (
              <span
                key={m}
                className="absolute right-2 -translate-y-2 text-xs text-chrome"
                style={{ top: (m - SALON.openMin) * PX_PER_MIN }}
              >
                {formatTime(m)}
              </span>
            ))}
          </div>

          {STAFF.map((s) => (
            <div key={s.id} className="relative border-l border-line" style={{ height }}>
              {hours.map((m) => (
                <div
                  key={m}
                  className="absolute inset-x-0 border-t border-line/70"
                  style={{ top: (m - SALON.openMin) * PX_PER_MIN }}
                />
              ))}
              {appointments
                .filter((a) => a.staffId === s.id)
                .map((a) => {
                  const isNew = a.id === highlightId;
                  return (
                    <div
                      key={a.id}
                      title={SOURCE_LABEL[a.source]}
                      className={`absolute inset-x-1.5 overflow-hidden rounded-lg px-2 py-1 text-xs ${SOURCE_STYLE[a.source]} ${
                        isNew ? "animate-slot-in !border-2 !border-cherry !bg-white" : ""
                      }`}
                      style={{ top: (a.start - SALON.openMin) * PX_PER_MIN + 1, height: (a.end - a.start) * PX_PER_MIN - 2 }}
                    >
                      <p className="font-semibold">
                        {isNew && <span className="text-cherry">Nuovo </span>}
                        {formatTime(a.start)} {a.customer}
                      </p>
                      <p className="truncate text-ink-soft">{serviceById(a.serviceId)?.name}</p>
                    </div>
                  );
                })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AgendaLegend() {
  return (
    <ul className="flex flex-wrap gap-4 text-xs text-ink-soft">
      {(Object.keys(SOURCE_LABEL) as Appointment["source"][]).map((k) => (
        <li key={k} className="flex items-center gap-1.5">
          <span className={`h-3 w-3 rounded ${SOURCE_STYLE[k]}`} />
          {SOURCE_LABEL[k]}
        </li>
      ))}
    </ul>
  );
}

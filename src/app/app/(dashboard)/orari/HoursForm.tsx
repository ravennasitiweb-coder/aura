"use client";

import { useActionState, useState } from "react";
import { saveOpeningHours } from "@/app/app/actions";
import { FormMessage, SubmitButton } from "@/components/app/ui";
import { WEEKDAYS } from "@/lib/format";

export type DayHours = { weekday: number; open: boolean; s1: string; e1: string; split: boolean; s2: string; e2: string };

const TIME = "rounded-lg border border-line bg-white px-2 py-1.5 outline-none focus:border-bottle disabled:bg-paper disabled:text-chrome";

export function HoursForm({ days, isSuggestion, canEdit }: { days: DayHours[]; isSuggestion: boolean; canEdit: boolean }) {
  const [state, action] = useActionState(saveOpeningHours, {});
  // Solo per mostrare/nascondere i campi; i valori li legge il server dal modulo
  const [open, setOpen] = useState(() => Object.fromEntries(days.map((d) => [d.weekday, d.open])));
  const [split, setSplit] = useState(() => Object.fromEntries(days.map((d) => [d.weekday, d.split])));

  return (
    <form action={action} className="space-y-4">
      {isSuggestion && (
        <p className="rounded-xl bg-mint px-4 py-3 text-sm text-bottle-dark">
          Ti proponiamo gli orari più comuni: chiuso domenica e lunedì, 9–13 e 15–19. Modificali e premi <strong>Salva orari</strong>.
        </p>
      )}

      <div className="divide-y divide-line rounded-2xl border border-line bg-white">
        {days.map((d) => {
          const isOpen = open[d.weekday];
          const isSplit = split[d.weekday];
          const dayName = WEEKDAYS[d.weekday - 1];
          return (
            <fieldset key={d.weekday} className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
              <legend className="sr-only">{dayName}</legend>
              <label className="flex w-36 items-center gap-2 font-semibold">
                <input
                  type="checkbox"
                  name={`d${d.weekday}_open`}
                  defaultChecked={d.open}
                  disabled={!canEdit}
                  onChange={(e) => setOpen((o) => ({ ...o, [d.weekday]: e.target.checked }))}
                  className="h-4 w-4 accent-bottle"
                />
                {dayName}
              </label>

              {isOpen ? (
                <>
                  <span className="flex items-center gap-1.5 text-sm">
                    <input type="time" step={900} name={`d${d.weekday}_s1`} defaultValue={d.s1} disabled={!canEdit} aria-label={`${dayName}, apertura`} className={TIME} />
                    –
                    {/* Senza pausa la chiusura è quella serale: la key ricrea il campo quando cambia */}
                    <input
                      key={`e1-${isSplit}`}
                      type="time"
                      step={900}
                      name={`d${d.weekday}_e1`}
                      defaultValue={isSplit || !d.split ? d.e1 : d.e2}
                      disabled={!canEdit}
                      aria-label={`${dayName}, chiusura${isSplit ? " mattina" : ""}`}
                      className={TIME}
                    />
                  </span>

                  <label className="flex items-center gap-2 text-sm text-ink-soft">
                    <input
                      type="checkbox"
                      name={`d${d.weekday}_split`}
                      defaultChecked={d.split}
                      disabled={!canEdit}
                      onChange={(e) => setSplit((s) => ({ ...s, [d.weekday]: e.target.checked }))}
                      className="h-4 w-4 accent-bottle"
                    />
                    Pausa
                  </label>

                  {isSplit && (
                    <span className="flex items-center gap-1.5 text-sm">
                      <input type="time" step={900} name={`d${d.weekday}_s2`} defaultValue={d.s2} disabled={!canEdit} aria-label={`${dayName}, riapertura`} className={TIME} />
                      –
                      <input type="time" step={900} name={`d${d.weekday}_e2`} defaultValue={d.e2} disabled={!canEdit} aria-label={`${dayName}, chiusura`} className={TIME} />
                    </span>
                  )}
                </>
              ) : (
                <span className="text-sm text-chrome">Chiuso</span>
              )}
            </fieldset>
          );
        })}
      </div>

      {canEdit && (
        <div className="flex items-center gap-4">
          <SubmitButton>Salva orari</SubmitButton>
          <FormMessage state={state} />
        </div>
      )}
    </form>
  );
}

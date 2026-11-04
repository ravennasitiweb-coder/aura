"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createAppointment, findFreeSlots } from "@/app/app/agenda-actions";
import { FormMessage, INPUT, LABEL, SubmitButton } from "@/components/app/ui";
import { minutesToTime, type FreeSlot } from "@/lib/agenda";
import type { AgendaProps } from "./AgendaBoard";

export function NewAppointmentForm({ date: agendaDate, today, appointments, staff, services, links }: AgendaProps) {
  const [state, action] = useActionState(createAppointment, {});
  const formRef = useRef<HTMLFormElement>(null);

  const bookable = services.filter((s) => s.active);
  const [serviceId, setServiceId] = useState(bookable[0]?.id ?? "");
  const [staffId, setStaffId] = useState(""); // "" = chiunque sia libero
  const [date, setDate] = useState(agendaDate);
  const [slots, setSlots] = useState<FreeSlot[]>([]);
  const [chosen, setChosen] = useState<FreeSlot | null>(null);
  const [manual, setManual] = useState(false);
  const [loading, startLoading] = useTransition();

  const capableStaff = useMemo(() => {
    const ids = new Set(links.filter((l) => l.service_id === serviceId).map((l) => l.staff_id));
    return staff.filter((s) => s.active && ids.has(s.id));
  }, [links, serviceId, staff]);

  // Cambia quando cambia l'agenda (es. dopo un salvataggio): serve a ricalcolare gli orari
  const agendaVersion = appointments.map((a) => `${a.id}:${a.status}`).join(",");

  useEffect(() => {
    let cancelled = false;
    startLoading(async () => {
      const result = await findFreeSlots(date, serviceId, staffId || null);
      if (!cancelled) {
        setSlots(result);
        setChosen(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [date, serviceId, staffId, agendaVersion]);

  // Dopo un salvataggio riuscito: svuota i dati del cliente
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  // Con "chiunque" mostra un solo pulsante per orario, con il primo collaboratore libero
  const visibleSlots = staffId ? slots : slots.filter((s, i) => slots.findIndex((o) => o.start === s.start) === i);
  const staffName = (id: string) => staff.find((s) => s.id === id)?.name ?? "";
  const isPast = date < today;

  return (
    <form ref={formRef} action={action} className="space-y-4 rounded-2xl bg-mint p-5">
      <h2 className="font-semibold text-bottle-dark">Nuovo appuntamento</h2>

      <div>
        <label htmlFor="appt-service" className={LABEL}>Servizio</label>
        <select id="appt-service" name="service_id" value={serviceId} onChange={(e) => setServiceId(e.target.value)} className={`${INPUT} mt-1.5`}>
          {bookable.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.duration_min} min)
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="appt-staff" className={LABEL}>Con</label>
          <select id="appt-staff" value={staffId} onChange={(e) => setStaffId(e.target.value)} className={`${INPUT} mt-1.5`}>
            <option value="">Chiunque sia libero</option>
            {capableStaff.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="appt-date" className={LABEL}>Giorno</label>
          <input id="appt-date" type="date" name="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${INPUT} mt-1.5`} />
        </div>
      </div>

      {/* Orari liberi */}
      {!manual && (
        <fieldset>
          <legend className={LABEL}>Orari liberi</legend>
          {capableStaff.length === 0 ? (
            <p className="mt-1.5 text-sm text-bottle-dark">
              Nessun collaboratore esegue questo servizio. Indicalo in Collaboratori.
            </p>
          ) : loading ? (
            <p className="mt-1.5 text-sm text-bottle-dark">Cerco gli orari liberi…</p>
          ) : visibleSlots.length === 0 ? (
            <p className="mt-1.5 text-sm text-bottle-dark">
              {isPast ? "Il giorno è passato." : "Nessun orario libero in questo giorno."} Puoi inserire un orario a mano.
            </p>
          ) : (
            <div className="mt-2 flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
              {visibleSlots.map((s) => {
                const isChosen = chosen?.start === s.start && chosen.staffId === s.staffId;
                return (
                  <button
                    key={`${s.staffId}-${s.start}`}
                    type="button"
                    onClick={() => setChosen(s)}
                    aria-pressed={isChosen}
                    title={`Con ${staffName(s.staffId)}`}
                    className={`rounded-full border px-3 py-1 text-sm ${
                      isChosen ? "border-bottle bg-bottle text-white" : "border-bottle/30 bg-white text-bottle hover:border-bottle"
                    }`}
                  >
                    {minutesToTime(s.start)}
                  </button>
                );
              })}
            </div>
          )}
          {chosen && (
            <p className="mt-2 text-sm text-bottle-dark">
              Alle {minutesToTime(chosen.start)} con <strong>{staffName(chosen.staffId)}</strong>
            </p>
          )}
        </fieldset>
      )}

      {manual ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="appt-time" className={LABEL}>Orario</label>
            <input id="appt-time" type="time" name="time" step={300} required className={`${INPUT} mt-1.5`} />
          </div>
          <div>
            <label htmlFor="appt-staff-manual" className={LABEL}>Collaboratore</label>
            <select id="appt-staff-manual" name="staff_id" defaultValue={staffId} required className={`${INPUT} mt-1.5`}>
              <option value="" disabled>Scegli…</option>
              {capableStaff.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <>
          <input type="hidden" name="time" value={chosen ? minutesToTime(chosen.start) : ""} />
          <input type="hidden" name="staff_id" value={chosen?.staffId ?? ""} />
        </>
      )}
      <button type="button" onClick={() => setManual((m) => !m)} className="text-sm font-semibold text-bottle underline-offset-2 hover:underline">
        {manual ? "Scegli tra gli orari liberi" : "Inserisci un orario a mano"}
      </button>

      <div>
        <label htmlFor="appt-name" className={LABEL}>Cliente</label>
        <input id="appt-name" name="customer_name" required maxLength={80} placeholder="Nome e cognome" autoComplete="off" className={`${INPUT} mt-1.5`} />
      </div>
      <div>
        <label htmlFor="appt-phone" className={LABEL}>
          Telefono <span className="font-normal text-ink-soft">(facoltativo)</span>
        </label>
        <input id="appt-phone" name="customer_phone" type="tel" maxLength={30} autoComplete="off" className={`${INPUT} mt-1.5`} />
      </div>
      <div>
        <label htmlFor="appt-notes" className={LABEL}>
          Note <span className="font-normal text-ink-soft">(facoltative)</span>
        </label>
        <textarea id="appt-notes" name="notes" maxLength={500} rows={2} className={`${INPUT} mt-1.5`} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Salvataggio…">Salva appuntamento</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createAppointment, findFreeSlots, updateAppointment } from "@/app/app/agenda-actions";
import { FormMessage, INPUT, LABEL, SubmitButton } from "@/components/app/ui";
import { minutesToTime, type FreeSlot } from "@/lib/agenda";
import type { AgendaAppointment } from "@/lib/agenda-data";
import type { AgendaProps } from "./AgendaBoard";

type Props = AgendaProps & {
  // Se presente, il modulo modifica questo appuntamento invece di crearne uno nuovo
  editing?: AgendaAppointment;
  onDone?: () => void;
};

export function AppointmentForm({ date: agendaDate, today, appointments, staff, services, links, editing, onDone }: Props) {
  const [state, action] = useActionState(editing ? updateAppointment : createAppointment, {});
  const formRef = useRef<HTMLFormElement>(null);
  const prefix = editing ? "edit" : "new"; // id dei campi unici anche con due moduli aperti

  // In modifica resta selezionabile anche un servizio nel frattempo disattivato
  const bookable = services.filter((s) => s.active || s.id === editing?.service_id);
  const [serviceId, setServiceId] = useState(editing?.service_id ?? bookable[0]?.id ?? "");
  const [staffId, setStaffId] = useState(editing?.staff_id ?? ""); // "" = chiunque sia libero
  const [date, setDate] = useState(agendaDate);
  const [slots, setSlots] = useState<FreeSlot[]>([]);
  const [chosen, setChosen] = useState<FreeSlot | null>(
    editing ? { staffId: editing.staff_id, start: editing.start_min } : null,
  );
  const [manual, setManual] = useState(false);
  const [loading, startLoading] = useTransition();

  const capableStaff = useMemo(() => {
    const ids = new Set(links.filter((l) => l.service_id === serviceId).map((l) => l.staff_id));
    return staff.filter((s) => s.active && ids.has(s.id));
  }, [links, serviceId, staff]);

  // Cambia quando cambia l'agenda (es. dopo un salvataggio): serve a ricalcolare gli orari
  const agendaVersion = appointments.map((a) => `${a.id}:${a.status}:${a.start_min}:${a.staff_id}`).join(",");

  useEffect(() => {
    let cancelled = false;
    startLoading(async () => {
      const result = await findFreeSlots(date, serviceId, staffId || null, editing?.id);
      if (!cancelled) {
        setSlots(result);
        // Mantiene la scelta se è ancora libera (es. l'orario attuale in modifica)
        setChosen((c) => (c && result.some((s) => s.start === c.start && s.staffId === c.staffId) ? c : null));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [date, serviceId, staffId, agendaVersion, editing?.id]);

  // Dopo un salvataggio riuscito: chiude la modifica, oppure svuota il modulo nuovo
  useEffect(() => {
    if (!state.ok) return;
    if (editing) onDone?.();
    else formRef.current?.reset();
  }, [state, editing, onDone]);

  // Con "chiunque" mostra un solo pulsante per orario, con il primo collaboratore libero
  const visibleSlots = staffId ? slots : slots.filter((s, i) => slots.findIndex((o) => o.start === s.start) === i);
  const staffName = (id: string) => staff.find((s) => s.id === id)?.name ?? "";
  const isPast = date < today;

  return (
    <form ref={formRef} action={action} className={`space-y-4 rounded-2xl p-5 ${editing ? "border-2 border-bottle bg-white" : "bg-mint"}`}>
      {editing && <input type="hidden" name="id" value={editing.id} />}
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-semibold text-bottle-dark">
          {editing ? `Modifica: ${editing.customer_name}` : "Nuovo appuntamento"}
        </h2>
        {editing && (
          <button type="button" onClick={onDone} className="text-sm text-ink-soft hover:text-ink">
            Annulla modifica
          </button>
        )}
      </div>

      <div>
        <label htmlFor={`${prefix}-service`} className={LABEL}>Servizio</label>
        <select
          id={`${prefix}-service`}
          name="service_id"
          value={serviceId}
          onChange={(e) => {
            setServiceId(e.target.value);
            // Il collaboratore scelto potrebbe non fare il nuovo servizio
            if (editing) setStaffId("");
          }}
          className={`${INPUT} mt-1.5`}
        >
          {bookable.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.duration_min} min)
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`${prefix}-staff`} className={LABEL}>Con</label>
          <select id={`${prefix}-staff`} value={staffId} onChange={(e) => setStaffId(e.target.value)} className={`${INPUT} mt-1.5`}>
            <option value="">Chiunque sia libero</option>
            {capableStaff.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${prefix}-date`} className={LABEL}>Giorno</label>
          <input id={`${prefix}-date`} type="date" name="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${INPUT} mt-1.5`} />
        </div>
      </div>

      {/* Orari liberi */}
      {!manual && (
        <fieldset>
          <legend className={LABEL}>Orari liberi</legend>
          {capableStaff.length === 0 ? (
            <p className="mt-1.5 text-sm text-bottle-dark">Nessun collaboratore esegue questo servizio. Indicalo in Collaboratori.</p>
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
            <label htmlFor={`${prefix}-time`} className={LABEL}>Orario</label>
            <input
              id={`${prefix}-time`}
              type="time"
              name="time"
              step={300}
              required
              defaultValue={editing ? minutesToTime(editing.start_min) : undefined}
              className={`${INPUT} mt-1.5`}
            />
          </div>
          <div>
            <label htmlFor={`${prefix}-staff-manual`} className={LABEL}>Collaboratore</label>
            <select id={`${prefix}-staff-manual`} name="staff_id" defaultValue={staffId} required className={`${INPUT} mt-1.5`}>
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
        <label htmlFor={`${prefix}-name`} className={LABEL}>Cliente</label>
        <input
          id={`${prefix}-name`}
          name="customer_name"
          required
          maxLength={80}
          defaultValue={editing?.customer_name}
          placeholder="Nome e cognome"
          autoComplete="off"
          className={`${INPUT} mt-1.5`}
        />
      </div>
      <div>
        <label htmlFor={`${prefix}-phone`} className={LABEL}>
          Telefono <span className="font-normal text-ink-soft">(facoltativo)</span>
        </label>
        <input
          id={`${prefix}-phone`}
          name="customer_phone"
          type="tel"
          maxLength={30}
          defaultValue={editing?.customer_phone ?? ""}
          autoComplete="off"
          className={`${INPUT} mt-1.5`}
        />
      </div>
      <div>
        <label htmlFor={`${prefix}-notes`} className={LABEL}>
          Note <span className="font-normal text-ink-soft">(facoltative)</span>
        </label>
        <textarea id={`${prefix}-notes`} name="notes" maxLength={500} rows={2} defaultValue={editing?.notes ?? ""} className={`${INPUT} mt-1.5`} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Salvataggio…">{editing ? "Salva modifiche" : "Salva appuntamento"}</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

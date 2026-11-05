"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useState } from "react";
import { setAppointmentStatus } from "@/app/app/agenda-actions";
import { FormMessage } from "@/components/app/ui";
import { addDays, formatLongDate, minutesToTime, type TimeRange } from "@/lib/agenda";
import type { AgendaAppointment } from "@/lib/agenda-data";
import { AppointmentForm } from "./AppointmentForm";
import { ViewSwitch } from "./ViewSwitch";

type Staff = { id: string; name: string; role_title: string | null; active: boolean };
type Service = { id: string; name: string; duration_min: number; active: boolean };

export type AgendaProps = {
  date: string;
  today: string;
  appointments: AgendaAppointment[];
  staff: Staff[];
  services: Service[];
  links: { staff_id: string; service_id: string }[];
  openRanges: TimeRange[];
};

const PX_PER_MIN = 1.6;

const STATUS_LABEL: Record<AgendaAppointment["status"], string> = {
  confirmed: "Confermato",
  completed: "Completato",
  cancelled: "Annullato",
  no_show: "Non si è presentato",
};

const SOURCE_LABEL: Record<AgendaAppointment["source"], string> = {
  manual: "Inserito a mano",
  online: "Prenotato online",
  chatbot: "Prenotato dall'assistente",
};

export function AgendaBoard(props: AgendaProps) {
  const { date, today, appointments, staff, services, openRanges } = props;
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const selected = appointments.find((a) => a.id === selectedId) ?? null;
  const stopEditing = useCallback(() => setEditing(false), []);
  const select = (id: string | null) => {
    setSelectedId(id);
    setEditing(false);
  };

  // Colonne: collaboratori attivi, più chi ha appuntamenti quel giorno anche se disattivato
  const columns = staff.filter((s) => s.active || appointments.some((a) => a.staff_id === s.id));

  // Intervallo visibile: dall'apertura alla chiusura, allargato agli appuntamenti fuori orario
  const starts = [...openRanges.map((r) => r.start), ...appointments.map((a) => a.start_min)];
  const ends = [...openRanges.map((r) => r.end), ...appointments.map((a) => a.end_min)];
  const dayStart = starts.length ? Math.floor(Math.min(...starts) / 60) * 60 : 9 * 60;
  const dayEnd = ends.length ? Math.ceil(Math.max(...ends) / 60) * 60 : 19 * 60;
  const hours: number[] = [];
  for (let m = dayStart; m <= dayEnd; m += 60) hours.push(m);
  const height = (dayEnd - dayStart) * PX_PER_MIN;

  // Fasce di chiusura (prima, tra e dopo le fasce di apertura)
  const closed: TimeRange[] = [];
  let cursor = dayStart;
  for (const r of [...openRanges].sort((a, b) => a.start - b.start)) {
    if (r.start > cursor) closed.push({ start: cursor, end: r.start });
    cursor = Math.max(cursor, r.end);
  }
  if (cursor < dayEnd) closed.push({ start: cursor, end: dayEnd });

  const active = appointments.filter((a) => a.status !== "cancelled");

  return (
    <div className="space-y-6">
      {/* Intestazione e navigazione tra i giorni */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-soft">{date === today ? "Oggi" : "Agenda"}</p>
          <h1 className="font-display text-3xl font-bold capitalize tracking-tight">{formatLongDate(date)}</h1>
          <p className="text-sm text-ink-soft">
            {active.length === 1 ? "1 appuntamento" : `${active.length} appuntamenti`}
            {openRanges.length === 0 && ", chiuso"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ViewSwitch view="giorno" date={date} />
          <Link href={`/app/agenda?data=${addDays(date, -1)}`} className="rounded-full border border-line bg-white px-3 py-2 text-sm hover:border-ink" aria-label="Giorno precedente">
            ‹
          </Link>
          <Link href="/app/agenda" className="rounded-full border border-line bg-white px-4 py-2 text-sm hover:border-ink">
            Oggi
          </Link>
          <Link href={`/app/agenda?data=${addDays(date, 1)}`} className="rounded-full border border-line bg-white px-3 py-2 text-sm hover:border-ink" aria-label="Giorno successivo">
            ›
          </Link>
          <label className="sr-only" htmlFor="agenda-date">Vai al giorno</label>
          <input
            id="agenda-date"
            type="date"
            value={date}
            onChange={(e) => e.target.value && router.push(`/app/agenda?data=${e.target.value}`)}
            className="rounded-full border border-line bg-white px-3 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        {/* Griglia */}
        <div className="min-w-0">
          {columns.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line p-6 text-ink-soft">
              Per usare l&apos;agenda aggiungi almeno un collaboratore in{" "}
              <Link href="/app/collaboratori" className="font-semibold text-bottle underline">Collaboratori</Link>.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-line bg-white">
              <div style={{ minWidth: 56 + columns.length * 160 }}>
                <div className="grid border-b border-line" style={{ gridTemplateColumns: `56px repeat(${columns.length}, 1fr)` }}>
                  <div />
                  {columns.map((s) => (
                    <div key={s.id} className="border-l border-line px-3 py-3">
                      <p className="font-semibold">{s.name}</p>
                      <p className="truncate text-xs text-ink-soft">{s.role_title ?? (s.active ? "" : "Non attivo")}</p>
                    </div>
                  ))}
                </div>

                <div className="grid" style={{ gridTemplateColumns: `56px repeat(${columns.length}, 1fr)` }}>
                  <div className="relative" style={{ height }}>
                    {hours.map((m) => (
                      <span key={m} className="absolute right-2 -translate-y-2 text-xs text-chrome" style={{ top: (m - dayStart) * PX_PER_MIN }}>
                        {minutesToTime(m)}
                      </span>
                    ))}
                  </div>

                  {columns.map((s) => (
                    <div key={s.id} className="relative border-l border-line" style={{ height }}>
                      {closed.map((c) => (
                        <div
                          key={c.start}
                          className="absolute inset-x-0 bg-[repeating-linear-gradient(135deg,var(--color-paper)_0_6px,transparent_6px_12px)]"
                          style={{ top: (c.start - dayStart) * PX_PER_MIN, height: (c.end - c.start) * PX_PER_MIN }}
                          aria-hidden="true"
                        />
                      ))}
                      {hours.map((m) => (
                        <div key={m} className="absolute inset-x-0 border-t border-line/70" style={{ top: (m - dayStart) * PX_PER_MIN }} />
                      ))}
                      {appointments
                        .filter((a) => a.staff_id === s.id)
                        .map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => select(a.id)}
                            aria-pressed={selectedId === a.id}
                            className={`absolute inset-x-1.5 overflow-hidden rounded-lg border px-2 py-1 text-left text-xs ${
                              a.status === "cancelled"
                                ? "border-dashed border-line bg-white/60 text-chrome line-through"
                                : a.status === "no_show"
                                  ? "border-cherry/40 bg-cherry/5"
                                  : a.status === "completed"
                                    ? "border-line bg-paper"
                                    : "border-mint-deep bg-mint"
                            } ${selectedId === a.id ? "ring-2 ring-bottle" : ""}`}
                            style={{ top: (a.start_min - dayStart) * PX_PER_MIN + 1, height: Math.max((a.end_min - a.start_min) * PX_PER_MIN - 2, 22) }}
                          >
                            <span className="block truncate font-semibold">
                              {minutesToTime(a.start_min)} {a.customer_name}
                            </span>
                            <span className="block truncate text-ink-soft">{a.service_name}</span>
                          </button>
                        ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pannello laterale: dettaglio o nuovo appuntamento */}
        <div className="space-y-4">
          {selected && editing ? (
            <AppointmentForm key={`edit-${selected.id}`} {...props} editing={selected} onDone={stopEditing} />
          ) : (
            selected && (
              <AppointmentDetail
                key={selected.id}
                appointment={selected}
                staffName={staff.find((s) => s.id === selected.staff_id)?.name ?? ""}
                onClose={() => select(null)}
                onEdit={() => setEditing(true)}
              />
            )
          )}
          {editing ? null : services.length > 0 && columns.length > 0 ? (
            // key: il modulo riparte dal giorno mostrato quando cambi giorno in agenda
            <AppointmentForm key={date} {...props} />
          ) : (
            columns.length > 0 && (
              <p className="rounded-2xl border border-dashed border-line p-5 text-sm text-ink-soft">
                Per inserire appuntamenti aggiungi prima i{" "}
                <Link href="/app/servizi" className="font-semibold text-bottle underline">servizi</Link>.
              </p>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function AppointmentDetail({
  appointment: a,
  staffName,
  onClose,
  onEdit,
}: {
  appointment: AgendaAppointment;
  staffName: string;
  onClose: () => void;
  onEdit: () => void;
}) {
  const [state, action] = useActionState(setAppointmentStatus, {});

  return (
    <section aria-label="Dettaglio appuntamento" className="rounded-2xl border border-line bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-ink-soft">
            {minutesToTime(a.start_min)}–{minutesToTime(a.end_min)} con {staffName}
          </p>
          <h2 className="font-display text-xl font-bold">{a.customer_name}</h2>
          <p>{a.service_name}</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-full px-2 text-xl text-ink-soft hover:text-ink" aria-label="Chiudi dettaglio">
          ×
        </button>
      </div>

      <dl className="mt-4 space-y-1 text-sm">
        <div className="flex gap-2">
          <dt className="text-ink-soft">Stato:</dt>
          <dd className="font-semibold">{STATUS_LABEL[a.status]}</dd>
        </div>
        {a.customer_phone && (
          <div className="flex gap-2">
            <dt className="text-ink-soft">Telefono:</dt>
            <dd>
              <a href={`tel:${a.customer_phone}`} className="text-bottle underline">{a.customer_phone}</a>
            </dd>
          </div>
        )}
        {a.customer_email && (
          <div className="flex gap-2">
            <dt className="text-ink-soft">Email:</dt>
            <dd className="min-w-0 truncate">
              <a href={`mailto:${a.customer_email}`} className="text-bottle underline">{a.customer_email}</a>
            </dd>
          </div>
        )}
        <div className="flex gap-2">
          <dt className="text-ink-soft">Origine:</dt>
          <dd>{SOURCE_LABEL[a.source]}</dd>
        </div>
        {a.notes && <p className="mt-2 rounded-lg bg-paper p-3">{a.notes}</p>}
      </dl>

      <form action={action} className="mt-5 flex flex-wrap gap-2">
        <input type="hidden" name="id" value={a.id} />
        {a.status === "confirmed" ? (
          <>
            <button type="button" onClick={onEdit} className="rounded-full bg-bottle px-4 py-2 text-sm font-semibold text-white hover:bg-bottle-dark">
              Sposta o modifica
            </button>
            <StatusButton status="completed" label="Completato" />
            <StatusButton status="no_show" label="Non si è presentato" />
            <button
              type="submit"
              name="status"
              value="cancelled"
              onClick={(e) => {
                if (!confirm(`Annullare l'appuntamento di ${a.customer_name}? L'orario tornerà libero.`)) e.preventDefault();
              }}
              className="rounded-full px-4 py-2 text-sm font-semibold text-cherry hover:bg-cherry/5"
            >
              Annulla appuntamento
            </button>
          </>
        ) : (
          <StatusButton status="confirmed" label="Ripristina come confermato" />
        )}
      </form>
      <div className="mt-2">
        <FormMessage state={state} />
      </div>
    </section>
  );
}

function StatusButton({ status, label }: { status: string; label: string }) {
  return (
    <button type="submit" name="status" value={status} className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-ink">
      {label}
    </button>
  );
}

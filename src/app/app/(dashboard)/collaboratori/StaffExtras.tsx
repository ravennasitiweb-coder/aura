"use client";

import { useActionState, useState } from "react";
import { CopyLink } from "@/components/app/CopyLink";
import { FormMessage, INPUT, SubmitButton } from "@/components/app/ui";
import { WEEKDAYS } from "@/lib/format";
import { addTimeOff, deleteTimeOff, inviteStaff, removeStaffAccess, revokeInvite, saveStaffHours } from "@/app/app/staff-actions";

export type StaffExtrasData = {
  staffId: string;
  staffName: string;
  hours: { weekday: number; opens_at: string; closes_at: string }[];
  timeOff: { id: string; label: string; reason: string | null }[];
  invites: { id: string; email: string; accepted: boolean }[];
  hasAccount: boolean;
  calendarPath: string;
};

const TIME = "rounded-lg border border-line bg-white px-2 py-1.5 text-sm outline-none focus:border-bottle";

export function StaffExtras({ data }: { data: StaffExtrasData }) {
  return (
    <div className="mt-2 space-y-2 pl-1">
      <details className="group rounded-xl border border-line bg-white">
        <summary className="cursor-pointer list-none px-4 py-2.5 text-sm font-semibold">
          Orari personali {data.hours.length > 0 ? <span className="font-normal text-bottle">(attivi)</span> : <span className="font-normal text-ink-soft">(segue l&apos;attività)</span>}
        </summary>
        <div className="border-t border-line p-4"><StaffHoursForm data={data} /></div>
      </details>
      <details className="rounded-xl border border-line bg-white">
        <summary className="cursor-pointer list-none px-4 py-2.5 text-sm font-semibold">
          Ferie e assenze {data.timeOff.length > 0 && <span className="font-normal text-bottle">({data.timeOff.length} in programma)</span>}
        </summary>
        <div className="border-t border-line p-4"><TimeOffSection data={data} /></div>
      </details>
      <details className="rounded-xl border border-line bg-white">
        <summary className="cursor-pointer list-none px-4 py-2.5 text-sm font-semibold">
          Accesso e calendario {data.hasAccount && <span className="font-normal text-bottle">(account collegato)</span>}
        </summary>
        <div className="space-y-4 border-t border-line p-4"><AccessSection data={data} /></div>
      </details>
    </div>
  );
}

function StaffHoursForm({ data }: { data: StaffExtrasData }) {
  const [state, action] = useActionState(saveStaffHours, {});
  const [custom, setCustom] = useState(data.hours.length > 0);
  const byDay = (d: number) => data.hours.filter((h) => h.weekday === d).sort((a, b) => a.opens_at.localeCompare(b.opens_at));
  const [open, setOpen] = useState(() => Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((d) => [d, data.hours.length ? byDay(d).length > 0 : d >= 2 && d <= 6])));

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="staff_id" value={data.staffId} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="custom" checked={custom} onChange={(e) => setCustom(e.target.checked)} className="h-4 w-4 accent-bottle" />
        {data.staffName} ha orari diversi da quelli dell&apos;attività
      </label>
      {custom && (
        <div className="divide-y divide-line rounded-lg border border-line">
          {[1, 2, 3, 4, 5, 6, 7].map((d) => {
            const r = byDay(d);
            return (
              <div key={d} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <label className="flex w-28 items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    name={`d${d}_open`}
                    checked={open[d]}
                    onChange={(e) => setOpen((o) => ({ ...o, [d]: e.target.checked }))}
                    className="h-4 w-4 accent-bottle"
                  />
                  {WEEKDAYS[d - 1]}
                </label>
                {open[d] ? (
                  <span className="flex flex-wrap items-center gap-1.5 text-sm">
                    <input type="time" step={900} name={`d${d}_s1`} defaultValue={r[0]?.opens_at.slice(0, 5) ?? "09:00"} aria-label={`${WEEKDAYS[d - 1]}, inizio`} className={TIME} />
                    –
                    <input type="time" step={900} name={`d${d}_e1`} defaultValue={r[0]?.closes_at.slice(0, 5) ?? "13:00"} aria-label={`${WEEKDAYS[d - 1]}, fine`} className={TIME} />
                    <span className="px-1 text-ink-soft">e</span>
                    <input type="time" step={900} name={`d${d}_s2`} defaultValue={r[1]?.opens_at.slice(0, 5) ?? ""} aria-label={`${WEEKDAYS[d - 1]}, inizio seconda fascia`} className={TIME} />
                    –
                    <input type="time" step={900} name={`d${d}_e2`} defaultValue={r[1]?.closes_at.slice(0, 5) ?? ""} aria-label={`${WEEKDAYS[d - 1]}, fine seconda fascia`} className={TIME} />
                  </span>
                ) : (
                  <span className="text-sm text-chrome">Non lavora</span>
                )}
              </div>
            );
          })}
        </div>
      )}
      {custom && <p className="text-xs text-ink-soft">La seconda fascia è facoltativa: lasciala vuota se fa orario continuato.</p>}
      <div className="flex items-center gap-3">
        <SubmitButton variant="secondary">Salva orari</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

function TimeOffSection({ data }: { data: StaffExtrasData }) {
  const [state, action] = useActionState(addTimeOff, {});
  const [delState, delAction] = useActionState(deleteTimeOff, {});

  return (
    <div className="space-y-4">
      {data.timeOff.length > 0 && (
        <ul className="space-y-2 text-sm">
          {data.timeOff.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-3 rounded-lg bg-paper px-3 py-2">
              <span>
                {o.label}
                {o.reason && <span className="text-ink-soft">, {o.reason}</span>}
              </span>
              <form action={delAction}>
                <input type="hidden" name="id" value={o.id} />
                <SubmitButton variant="danger" pendingLabel="…">Elimina</SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      )}
      <FormMessage state={delState} />
      <form action={action} className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
        <input type="hidden" name="staff_id" value={data.staffId} />
        <label className="text-sm">
          Dal
          <input type="datetime-local" name="from" required step={900} className={`${INPUT} mt-1`} />
        </label>
        <label className="text-sm">
          Al
          <input type="datetime-local" name="to" required step={900} className={`${INPUT} mt-1`} />
        </label>
        <label className="text-sm">
          Motivo <span className="text-ink-soft">(facoltativo)</span>
          <input name="reason" maxLength={80} placeholder="Es. Ferie" className={`${INPUT} mt-1`} />
        </label>
        <SubmitButton variant="secondary">Aggiungi</SubmitButton>
      </form>
      <FormMessage state={state} />
    </div>
  );
}

function AccessSection({ data }: { data: StaffExtrasData }) {
  const [state, action] = useActionState(inviteStaff, {});
  const [revState, revAction] = useActionState(revokeInvite, {});
  const [remState, remAction] = useActionState(removeStaffAccess, {});
  const pending = data.invites.filter((i) => !i.accepted);

  return (
    <>
      {data.hasAccount ? (
        <form
          action={remAction}
          onSubmit={(e) => {
            if (!confirm(`Togliere l'accesso a ${data.staffName}?`)) e.preventDefault();
          }}
          className="flex flex-wrap items-center gap-3 text-sm"
        >
          <input type="hidden" name="staff_id" value={data.staffId} />
          <span>{data.staffName} entra con il suo account e vede l&apos;agenda.</span>
          <SubmitButton variant="danger" pendingLabel="…">Togli l&apos;accesso</SubmitButton>
          <FormMessage state={remState} />
        </form>
      ) : (
        <form action={action} className="space-y-2">
          <input type="hidden" name="staff_id" value={data.staffId} />
          <p className="text-sm">Invita {data.staffName} a entrare con il suo account: vedrà l&apos;agenda e potrà gestire gli appuntamenti.</p>
          <div className="flex flex-wrap gap-2">
            <label className="sr-only" htmlFor={`invite-${data.staffId}`}>Email</label>
            <input id={`invite-${data.staffId}`} name="email" type="email" required maxLength={254} placeholder="email@esempio.it" className={`${INPUT} max-w-xs`} />
            <SubmitButton pendingLabel="Invio…">Invia invito</SubmitButton>
          </div>
          <FormMessage state={state} />
        </form>
      )}

      {pending.length > 0 && (
        <ul className="space-y-1 text-sm">
          {pending.map((i) => (
            <li key={i.id} className="flex items-center gap-3">
              <span className="text-ink-soft">Invito in attesa: {i.email}</span>
              <form action={revAction}>
                <input type="hidden" name="id" value={i.id} />
                <SubmitButton variant="danger" pendingLabel="…">Annulla</SubmitButton>
              </form>
            </li>
          ))}
          <li><FormMessage state={revState} /></li>
        </ul>
      )}

      <div className="border-t border-line pt-4 text-sm">
        <p className="font-semibold">Calendario sul telefono</p>
        <p className="mt-1 text-ink-soft">
          Copia questo link e aggiungilo in Google Calendar (Altri calendari → Da URL) o su iPhone (Calendario → Aggiungi abbonamento).
          Gli appuntamenti di {data.staffName} compariranno da soli. Non condividerlo con estranei.
        </p>
        <div className="mt-2"><CopyLink path={data.calendarPath} /></div>
      </div>
    </>
  );
}

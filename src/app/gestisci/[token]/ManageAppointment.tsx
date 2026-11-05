"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { addDays, minutesToTime, nowInTimezone, type FreeSlot } from "@/lib/agenda";
import { cancelAppointment, confirmAppointment, rescheduleAppointment, rescheduleSlots, type ManageResult } from "./actions";

export type ManagedAppointment = {
  salon_name: string;
  salon_slug: string;
  business_type: string;
  service_name: string;
  staff_name: string;
  starts_at: string;
  ends_at: string;
  status: "confirmed" | "completed" | "cancelled" | "no_show";
  customer_name: string;
  confirmed: boolean;
  cancel_hours: number;
  can_change: boolean;
};

const whenFormat = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });

export function ManageAppointment({
  token,
  appointment: a,
  place,
  highlightConfirm,
}: {
  token: string;
  appointment: ManagedAppointment;
  place: string;
  highlightConfirm: boolean;
}) {
  const router = useRouter();
  const [result, setResult] = useState<ManageResult | null>(null);
  const [pending, start] = useTransition();
  const [moving, setMoving] = useState(false);

  const run = (fn: () => Promise<ManageResult>) =>
    start(async () => {
      const r = await fn();
      setResult(r);
      if (r.ok) {
        setMoving(false);
        router.refresh();
      }
    });

  const isFuture = new Date(a.starts_at) > new Date();
  const active = a.status === "confirmed" && isFuture;

  return (
    <div className="mt-8 space-y-5">
      <section className="rounded-2xl border border-line bg-white p-6">
        <p className="text-sm text-ink-soft">Il tuo appuntamento da {a.salon_name}</p>
        <h1 className="mt-1 font-display text-2xl font-bold first-letter:uppercase">{whenFormat.format(new Date(a.starts_at))}</h1>
        <p className="mt-1">
          {a.service_name} con {a.staff_name}
        </p>
        <p className="mt-3 text-sm">
          {a.status === "cancelled"
            ? "❌ Annullato"
            : !isFuture
              ? "Appuntamento passato"
              : a.confirmed
                ? "✓ Hai confermato la tua presenza"
                : "In attesa della tua conferma"}
        </p>
      </section>

      {result && (
        <p role="status" className={`rounded-xl px-4 py-3 text-sm ${result.ok ? "bg-mint text-bottle-dark" : "border border-cherry/30 bg-cherry/5 text-cherry"}`}>
          {result.ok ? result.message : result.error}
        </p>
      )}

      {active && (
        <div className="space-y-3">
          {!a.confirmed && (
            <button
              type="button"
              disabled={pending}
              autoFocus={highlightConfirm}
              onClick={() => run(() => confirmAppointment(token))}
              className="w-full rounded-full bg-bottle px-6 py-3.5 text-lg font-semibold text-white hover:bg-bottle-dark disabled:opacity-60"
            >
              Confermo, ci sarò
            </button>
          )}

          {a.can_change ? (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() => setMoving((m) => !m)}
                className="w-full rounded-full border border-line bg-white px-6 py-3 font-semibold hover:border-ink disabled:opacity-60"
              >
                {moving ? "Chiudi" : "Sposta a un altro orario"}
              </button>
              {moving && <Reschedule token={token} pending={pending} onPick={(date, time) => run(() => rescheduleAppointment(token, date, time))} />}
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (confirm("Vuoi davvero annullare l'appuntamento?")) run(() => cancelAppointment(token));
                }}
                className="w-full rounded-full px-6 py-3 font-semibold text-cherry hover:bg-cherry/5 disabled:opacity-60"
              >
                Annulla l&apos;appuntamento
              </button>
            </>
          ) : (
            <p className="rounded-xl bg-paper px-4 py-3 text-sm text-ink-soft">
              Mancano meno di {a.cancel_hours} ore: per spostare o annullare contatta direttamente {place}.
            </p>
          )}
        </div>
      )}

      <p className="text-center text-sm text-ink-soft">
        <Link href={`/p/${a.salon_slug}`} className="text-bottle underline">Prenota un altro appuntamento</Link>
      </p>
    </div>
  );
}

function Reschedule({ token, pending, onPick }: { token: string; pending: boolean; onPick: (date: string, time: string) => void }) {
  const today = nowInTimezone("Europe/Rome").date;
  const [date, setDate] = useState(today);
  const [slots, setSlots] = useState<FreeSlot[]>([]);
  const [loading, startLoading] = useTransition();

  useEffect(() => {
    let cancelled = false;
    startLoading(async () => {
      const r = await rescheduleSlots(token, date);
      if (!cancelled) setSlots(r);
    });
    return () => {
      cancelled = true;
    };
  }, [token, date]);

  const unique = slots.filter((s, i) => slots.findIndex((o) => o.start === s.start) === i);

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-white p-4">
      <label className="block text-sm font-semibold">
        Nuovo giorno
        <input
          type="date"
          min={today}
          max={addDays(today, 90)}
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="mt-1 w-full rounded-xl border border-line px-3 py-2.5"
        />
      </label>
      {loading ? (
        <p className="text-sm text-ink-soft">Cerco gli orari liberi…</p>
      ) : unique.length === 0 ? (
        <p className="text-sm text-ink-soft">Nessun orario libero in questo giorno. Prova un altro giorno.</p>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {unique.map((s) => (
            <button
              key={s.start}
              type="button"
              disabled={pending}
              onClick={() => onPick(date, minutesToTime(s.start))}
              className="rounded-xl border border-line py-2.5 font-semibold text-bottle hover:border-bottle disabled:opacity-60"
            >
              {minutesToTime(s.start)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

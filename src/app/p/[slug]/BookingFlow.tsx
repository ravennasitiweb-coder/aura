"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { addDays, isoWeekday, minutesToTime, type FreeSlot } from "@/lib/agenda";
import { formatDuration, formatPrice } from "@/lib/format";
import type { PublicSalonInfo } from "@/lib/public-booking";
import { book, loadSlots, type BookingResult } from "./actions";

type Booking = Extract<BookingResult, { ok: true }>["booking"];

const VISIBLE_DAYS = 14;
const MAX_DAYS = 90;

const dayFormat = new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const longDayFormat = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const toUtcDate = (d: string) => new Date(`${d}T12:00:00Z`);

const INPUT = "mt-1.5 w-full rounded-xl border border-line bg-white px-4 py-3 outline-none focus:border-bottle";

export function BookingFlow({ slug, info, today }: { slug: string; info: PublicSalonInfo; today: string }) {
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [staffId, setStaffId] = useState<string>(""); // "" = chiunque
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<FreeSlot[]>([]);
  const [slot, setSlot] = useState<FreeSlot | null>(null);
  const [loading, startLoading] = useTransition();
  const [submitting, startSubmitting] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const service = info.services.find((s) => s.id === serviceId) ?? null;
  const capableStaff = useMemo(
    () => (serviceId ? info.staff.filter((s) => s.service_ids.includes(serviceId)) : []),
    [info.staff, serviceId],
  );
  const days = Array.from({ length: VISIBLE_DAYS }, (_, i) => addDays(today, i));
  const isOpenDay = (d: string) => info.open_weekdays.includes(isoWeekday(d));

  useEffect(() => {
    if (!serviceId || !date) return;
    let cancelled = false;
    startLoading(async () => {
      const result = await loadSlots(slug, serviceId, date, staffId || null);
      if (!cancelled) {
        setSlots(result);
        setSlot(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [slug, serviceId, date, staffId, reloadKey]);

  // Con "chiunque": un solo pulsante per orario
  const visibleSlots = staffId ? slots : slots.filter((s, i) => slots.findIndex((o) => o.start === s.start) === i);
  const staffName = (id: string) => info.staff.find((s) => s.id === id)?.name ?? "";

  function submit(formData: FormData) {
    if (!service || !slot || !date) return;
    formData.set("service_id", service.id);
    formData.set("staff_id", slot.staffId);
    formData.set("date", date);
    formData.set("time", minutesToTime(slot.start));
    setError(null);
    startSubmitting(async () => {
      const result = await book(slug, formData);
      if (result.ok) {
        setBooking(result.booking);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setError(result.error);
        if (result.slotTaken) setReloadKey((k) => k + 1);
      }
    });
  }

  if (booking) return <Confirmation booking={booking} onAnother={() => location.reload()} />;

  return (
    <div className="space-y-5">
      {/* 1. Servizio */}
      <Step number={1} title="Scegli il servizio">
        <div className="space-y-2">
          {info.services.map((s) => (
            <label
              key={s.id}
              className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-line bg-white px-4 py-3 has-[:checked]:border-bottle has-[:checked]:bg-mint"
            >
              <span className="flex items-center gap-3">
                <input
                  type="radio"
                  name="service"
                  value={s.id}
                  aria-label={`${s.name}, ${formatDuration(s.duration_min)}${s.price_cents > 0 ? `, ${formatPrice(s.price_cents)}` : ""}`}
                  checked={serviceId === s.id}
                  onChange={() => {
                    setServiceId(s.id);
                    setStaffId("");
                  }}
                  className="h-4 w-4 accent-bottle"
                />
                <span>
                  <span className="block font-semibold">{s.name}</span>
                  <span className="text-sm text-ink-soft">{formatDuration(s.duration_min)}</span>
                </span>
              </span>
              {s.price_cents > 0 && <span className="font-semibold">{formatPrice(s.price_cents)}</span>}
            </label>
          ))}
        </div>
      </Step>

      {/* 2. Giorno e operatore */}
      {service && (
        <Step number={2} title="Scegli il giorno">
          {capableStaff.length > 1 && (
            <div className="mb-4">
              <p className="mb-2 text-sm text-ink-soft">Con chi?</p>
              <div className="flex flex-wrap gap-2">
                {[{ id: "", name: "Chiunque" }, ...capableStaff].map((s) => (
                  <button
                    key={s.id || "any"}
                    type="button"
                    onClick={() => setStaffId(s.id)}
                    aria-pressed={staffId === s.id}
                    className={`rounded-full border px-4 py-2 text-sm ${
                      staffId === s.id ? "border-bottle bg-bottle text-white" : "border-line bg-white hover:border-bottle"
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
            {days.map((d) => {
              const open = isOpenDay(d);
              const [weekday, ...rest] = dayFormat.format(toUtcDate(d)).split(" ");
              return (
                <button
                  key={d}
                  type="button"
                  disabled={!open}
                  onClick={() => setDate(d)}
                  aria-pressed={date === d}
                  aria-label={`${longDayFormat.format(toUtcDate(d))}${open ? "" : ", chiuso"}`}
                  className={`flex w-16 shrink-0 flex-col items-center rounded-xl border py-2 text-sm ${
                    date === d
                      ? "border-bottle bg-bottle text-white"
                      : open
                        ? "border-line bg-white hover:border-bottle"
                        : "cursor-not-allowed border-transparent bg-transparent text-chrome"
                  }`}
                >
                  <span className="capitalize">{weekday.replace(".", "")}</span>
                  <span className="font-display text-lg font-bold">{rest[0]}</span>
                  <span className="text-xs">{open ? rest[1]?.replace(".", "") : "chiuso"}</span>
                </button>
              );
            })}
          </div>
          <label className="mt-2 block text-sm text-ink-soft">
            Altra data:{" "}
            <input
              type="date"
              min={today}
              max={addDays(today, MAX_DAYS)}
              value={date ?? ""}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="rounded-lg border border-line bg-white px-2 py-1"
            />
          </label>
        </Step>
      )}

      {/* 3. Orario */}
      {service && date && (
        <Step number={3} title={`Scegli l'orario, ${longDayFormat.format(toUtcDate(date))}`}>
          {loading ? (
            <p className="text-ink-soft">Cerco gli orari liberi…</p>
          ) : !isOpenDay(date) ? (
            <p className="text-ink-soft">Il salone è chiuso in questo giorno. Scegline un altro.</p>
          ) : visibleSlots.length === 0 ? (
            <p className="text-ink-soft">Nessun orario libero in questo giorno. Prova un altro giorno.</p>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {visibleSlots.map((s) => {
                const chosen = slot?.start === s.start && slot.staffId === s.staffId;
                return (
                  <button
                    key={`${s.staffId}-${s.start}`}
                    type="button"
                    onClick={() => setSlot(s)}
                    aria-pressed={chosen}
                    className={`rounded-xl border py-2.5 font-semibold ${
                      chosen ? "border-bottle bg-bottle text-white" : "border-line bg-white text-bottle hover:border-bottle"
                    }`}
                  >
                    {minutesToTime(s.start)}
                  </button>
                );
              })}
            </div>
          )}
        </Step>
      )}

      {/* 4. Dati */}
      {service && date && slot && (
        <Step number={4} title="I tuoi dati">
          <p className="mb-4 rounded-xl bg-mint px-4 py-3 text-bottle-dark">
            <strong>{service.name}</strong> alle <strong>{minutesToTime(slot.start)}</strong> con {staffName(slot.staffId)}
          </p>
          <form action={submit} className="space-y-4">
            <div>
              <label htmlFor="name" className="text-sm font-semibold">Nome e cognome</label>
              <input id="name" name="name" required maxLength={80} autoComplete="name" className={INPUT} />
            </div>
            <div>
              <label htmlFor="phone" className="text-sm font-semibold">Telefono</label>
              <input id="phone" name="phone" type="tel" required maxLength={30} autoComplete="tel" className={INPUT} />
              <p className="mt-1 text-xs text-ink-soft">Il salone lo userà solo per comunicazioni sull&apos;appuntamento.</p>
            </div>
            <div>
              <label htmlFor="email" className="text-sm font-semibold">
                Email <span className="font-normal text-ink-soft">(facoltativa)</span>
              </label>
              <input id="email" name="email" type="email" maxLength={254} autoComplete="email" className={INPUT} />
            </div>
            {/* Campo trappola per i bot: nascosto alle persone e ai lettori di schermo */}
            <div aria-hidden="true" className="absolute -left-[9999px]">
              <label>
                Sito web <input name="website" tabIndex={-1} autoComplete="off" />
              </label>
            </div>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" name="privacy" required className="mt-0.5 h-4 w-4 accent-bottle" />
              <span>
                Ho letto l&apos;
                <Link href="/privacy" target="_blank" className="text-bottle underline">informativa sulla privacy</Link> e acconsento al
                trattamento dei miei dati per gestire la prenotazione.
              </span>
            </label>

            {error && (
              <p role="alert" className="rounded-xl border border-cherry/30 bg-cherry/5 px-4 py-3 text-sm text-cherry">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-full bg-bottle px-6 py-3.5 text-lg font-semibold text-white hover:bg-bottle-dark disabled:opacity-60"
            >
              {submitting ? "Prenotazione in corso…" : "Conferma la prenotazione"}
            </button>
          </form>
        </Step>
      )}
    </div>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <h2 className="mb-4 flex items-center gap-3 font-display text-lg font-bold">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-mint text-sm text-bottle">{number}</span>
        <span className="first-letter:uppercase">{title}</span>
      </h2>
      {children}
    </section>
  );
}

const timeFormat = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });
const dateFormat = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Rome" });

function Confirmation({ booking, onAnother }: { booking: Booking; onAnother: () => void }) {
  const start = new Date(booking.starts_at);
  const end = new Date(booking.ends_at);

  function downloadCalendar() {
    const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const escape = (s: string) => s.replace(/[\\,;]/g, (c) => `\\${c}`);
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//SmartBooking//IT",
      "BEGIN:VEVENT",
      `UID:${booking.id}@smartbooking`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${escape(`${booking.service_name} da ${booking.salon_name}`)}`,
      `DESCRIPTION:${escape(`Con ${booking.staff_name}`)}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "appuntamento.ics";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section role="status" className="rounded-2xl border border-line bg-white p-6 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-mint text-2xl text-bottle" aria-hidden="true">✓</div>
      <h2 className="mt-4 font-display text-2xl font-bold">Prenotazione confermata</h2>
      <p className="mt-3 text-lg">
        <span className="first-letter:uppercase">{dateFormat.format(start)}</span> alle <strong>{timeFormat.format(start)}</strong>
      </p>
      <p className="text-ink-soft">
        {booking.service_name} con {booking.staff_name}, {booking.salon_name}
      </p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <button type="button" onClick={downloadCalendar} className="rounded-full bg-bottle px-6 py-3 font-semibold text-white hover:bg-bottle-dark">
          Aggiungi al calendario
        </button>
        <button type="button" onClick={onAnother} className="rounded-full border border-line px-6 py-3 font-semibold hover:border-ink">
          Prenota un altro appuntamento
        </button>
      </div>
      <p className="mt-6 text-sm text-ink-soft">Se non puoi venire, avvisa il salone il prima possibile.</p>
    </section>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { addDays, minutesToTime } from "@/lib/agenda";
import type { WeekAppointment } from "@/lib/agenda-data";
import { ViewSwitch } from "./ViewSwitch";

type Props = {
  monday: string;
  today: string;
  appointments: WeekAppointment[];
  staff: { id: string; name: string; active: boolean }[];
  hours: { weekday: number; start: number; end: number }[];
};

const PX_PER_MIN = 0.9;
const dayHeader = new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", timeZone: "UTC" });
const rangeFormat = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", timeZone: "UTC" });
const utc = (d: string) => new Date(`${d}T12:00:00Z`);

// Colori per distinguere i collaboratori quando si vedono tutti insieme
const STAFF_COLORS = ["bg-mint border-mint-deep", "bg-[#f3e4c9] border-[#e0c48f]", "bg-[#dde4f4] border-[#b4c3e6]", "bg-[#f2dde3] border-[#e0b4c1]", "bg-[#e4eedb] border-[#bfd6aa]"];

export function WeekBoard({ monday, today, appointments, staff, hours }: Props) {
  const [staffFilter, setStaffFilter] = useState("");
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const visible = appointments.filter((a) => a.status !== "cancelled" && (!staffFilter || a.staff_id === staffFilter));
  const colorOf = (staffId: string) => STAFF_COLORS[Math.max(0, staff.findIndex((s) => s.id === staffId)) % STAFF_COLORS.length];
  const staffName = (staffId: string) => staff.find((s) => s.id === staffId)?.name ?? "";

  // Intervallo visibile: dalla prima apertura all'ultima chiusura della settimana
  const allStarts = [...hours.map((h) => h.start), ...visible.map((a) => a.start_min)];
  const allEnds = [...hours.map((h) => h.end), ...visible.map((a) => a.end_min)];
  const dayStart = allStarts.length ? Math.floor(Math.min(...allStarts) / 60) * 60 : 9 * 60;
  const dayEnd = allEnds.length ? Math.ceil(Math.max(...allEnds) / 60) * 60 : 19 * 60;
  const height = (dayEnd - dayStart) * PX_PER_MIN;
  const hourMarks: number[] = [];
  for (let m = dayStart; m <= dayEnd; m += 60) hourMarks.push(m);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-soft">Settimana</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            {rangeFormat.format(utc(monday))} – {rangeFormat.format(utc(addDays(monday, 6)))}
          </h1>
          <p className="text-sm text-ink-soft">{visible.length === 1 ? "1 appuntamento" : `${visible.length} appuntamenti`}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ViewSwitch view="settimana" date={monday} />
          <Link href={`/app/agenda?vista=settimana&data=${addDays(monday, -7)}`} className="rounded-full border border-line bg-white px-3 py-2 text-sm hover:border-ink" aria-label="Settimana precedente">‹</Link>
          <Link href="/app/agenda?vista=settimana" className="rounded-full border border-line bg-white px-4 py-2 text-sm hover:border-ink">Questa settimana</Link>
          <Link href={`/app/agenda?vista=settimana&data=${addDays(monday, 7)}`} className="rounded-full border border-line bg-white px-3 py-2 text-sm hover:border-ink" aria-label="Settimana successiva">›</Link>
          {staff.length > 1 && (
            <select
              aria-label="Mostra il collaboratore"
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
              className="rounded-full border border-line bg-white px-3 py-2 text-sm"
            >
              <option value="">Tutti i collaboratori</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <div className="min-w-[760px]">
          <div className="grid border-b border-line" style={{ gridTemplateColumns: "48px repeat(7, 1fr)" }}>
            <div />
            {days.map((d) => {
              const open = hours.some((h) => h.weekday === days.indexOf(d) + 1);
              return (
                <Link
                  key={d}
                  href={`/app/agenda?data=${d}`}
                  className={`border-l border-line px-2 py-2.5 text-center text-sm capitalize hover:bg-paper ${d === today ? "font-bold text-bottle" : ""}`}
                >
                  {dayHeader.format(utc(d)).replace(".", "")}
                  {!open && <span className="block text-xs font-normal normal-case text-chrome">chiuso</span>}
                </Link>
              );
            })}
          </div>

          <div className="grid" style={{ gridTemplateColumns: "48px repeat(7, 1fr)" }}>
            <div className="relative" style={{ height }}>
              {hourMarks.map((m) => (
                <span key={m} className="absolute right-1.5 -translate-y-2 text-[11px] text-chrome" style={{ top: (m - dayStart) * PX_PER_MIN }}>
                  {minutesToTime(m)}
                </span>
              ))}
            </div>
            {days.map((d, i) => {
              const open = hours.filter((h) => h.weekday === i + 1);
              const dayAppointments = visible.filter((a) => a.day === d);
              return (
                <div key={d} className={`relative border-l border-line ${open.length === 0 ? "bg-paper" : ""}`} style={{ height }}>
                  {hourMarks.map((m) => (
                    <div key={m} className="absolute inset-x-0 border-t border-line/60" style={{ top: (m - dayStart) * PX_PER_MIN }} />
                  ))}
                  {dayAppointments.map((a) => {
                    // Più appuntamenti alla stessa ora (collaboratori diversi): si affiancano
                    const overlapping = dayAppointments.filter((o) => o.start_min < a.end_min && a.start_min < o.end_min);
                    const col = overlapping.indexOf(a);
                    const width = 100 / overlapping.length;
                    return (
                      <Link
                        key={a.id}
                        href={`/app/agenda?data=${d}`}
                        title={`${minutesToTime(a.start_min)} ${a.customer_name}, ${a.service_name} con ${staffName(a.staff_id)}`}
                        className={`absolute overflow-hidden rounded-md border px-1 text-[11px] leading-tight hover:z-10 hover:ring-2 hover:ring-bottle ${colorOf(a.staff_id)} ${
                          a.status === "no_show" ? "opacity-60" : ""
                        }`}
                        style={{
                          top: (a.start_min - dayStart) * PX_PER_MIN + 1,
                          height: Math.max((a.end_min - a.start_min) * PX_PER_MIN - 2, 16),
                          left: `calc(${col * width}% + 2px)`,
                          width: `calc(${width}% - 4px)`,
                        }}
                      >
                        <span className="font-semibold">{minutesToTime(a.start_min)}</span> {a.customer_name}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {staff.length > 1 && !staffFilter && (
        <ul className="flex flex-wrap gap-4 text-xs text-ink-soft" aria-label="Legenda colori">
          {staff.map((s) => (
            <li key={s.id} className="flex items-center gap-1.5">
              <span className={`h-3 w-3 rounded border ${colorOf(s.id)}`} />
              {s.name}
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-ink-soft">Clicca un giorno o un appuntamento per aprire la vista giornaliera e modificarlo.</p>
    </div>
  );
}

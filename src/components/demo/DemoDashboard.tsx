"use client";

import { useState } from "react";
import { Logo } from "@/components/Logo";
import { INITIAL_APPOINTMENTS, SALON, serviceById, type Appointment } from "@/lib/demo-data";
import { AgendaGrid, AgendaLegend } from "./AgendaGrid";
import { ChatPreview } from "./ChatPreview";

const NAV = [
  { label: "Agenda", active: true },
  { label: "Clienti" },
  { label: "Servizi" },
  { label: "Collaboratori" },
  { label: "Assistente AI (in arrivo)" },
  { label: "Impostazioni" },
];

export function DemoDashboard() {
  const [appointments, setAppointments] = useState<Appointment[]>(INITIAL_APPOINTMENTS);
  const [highlightId, setHighlightId] = useState<string>();

  function handleBook(booking: Omit<Appointment, "id">) {
    const id = `new-${appointments.length + 1}`;
    setAppointments((list) => [...list, { ...booking, id }]);
    setHighlightId(id);
  }

  const revenue = appointments.reduce((sum, a) => sum + (serviceById(a.serviceId)?.priceEur ?? 0), 0);
  const byAssistant = appointments.filter((a) => a.source === "chatbot").length;

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-line bg-white p-5 lg:flex">
        <Logo className="text-base" />
        <nav aria-label="Dashboard" className="mt-8 flex flex-col gap-1 text-sm">
          {NAV.map((n) => (
            <span
              key={n.label}
              aria-current={n.active ? "page" : undefined}
              className={`rounded-lg px-3 py-2 ${n.active ? "bg-mint font-semibold text-bottle-dark" : "text-ink-soft"}`}
            >
              {n.label}
            </span>
          ))}
        </nav>
        <p className="mt-auto text-xs text-chrome">Le altre sezioni arrivano nelle prossime fasi.</p>
      </aside>

      <div className="flex-1">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-white px-4 py-4 sm:px-6">
          <div>
            <p className="text-sm text-ink-soft">
              {SALON.name}, {SALON.city}
            </p>
            <h1 className="font-display text-2xl font-bold">Agenda di oggi</h1>
          </div>
          <span className="rounded-full bg-paper px-3 py-1 text-xs text-ink-soft">Ambiente demo, i dati non vengono salvati</span>
        </header>

        <div className="grid gap-6 p-4 sm:p-6 xl:grid-cols-[1fr_380px]">
          <div className="min-w-0 space-y-4">
            <dl className="grid grid-cols-3 gap-3">
              <Stat label="Appuntamenti" value={appointments.length} />
              <Stat label="Dall'assistente" value={byAssistant} />
              <Stat label="Incasso previsto" value={`${revenue} €`} />
            </dl>
            <AgendaGrid appointments={appointments} highlightId={highlightId} />
            <AgendaLegend />
          </div>
          <ChatPreview appointments={appointments} onBook={handleBook} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-line bg-white px-4 py-3">
      <dt className="text-xs text-ink-soft">{label}</dt>
      <dd className="font-display text-2xl font-bold">{value}</dd>
    </div>
  );
}

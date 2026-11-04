"use client";

import { useEffect, useState } from "react";

// Conversazione d'esempio mostrata nell'hero: la chat del cliente
// a sinistra, l'agenda del salone che si aggiorna a destra.
const SCRIPT = [
  { from: "cliente", text: "Ciao! Sabato mattina avete posto per taglio e barba?" },
  { from: "ai", text: "Ciao! Con Marco ho libero alle 10:30 o alle 11:30. Taglio e barba dura un'ora, 37 €. Quale preferisci?" },
  { from: "cliente", text: "10:30 perfetto" },
  { from: "ai", text: "Fatto! Ti aspettiamo sabato alle 10:30. Ti mando un promemoria venerdì." },
] as const;

const HOURS = ["9:00", "10:00", "11:00", "12:00", "13:00"];
const ROW = 44; // pixel per ora

export function HeroDemo() {
  const [shown, setShown] = useState(0);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const t = setTimeout(() => setShown(SCRIPT.length + 1), 0);
      return () => clearTimeout(t);
    }
    const delays = [600, 2000, 3600, 4800, 6000];
    const timers = delays.map((d, i) => setTimeout(() => setShown(i + 1), d));
    // Riparte dopo una pausa, così chi arriva tardi vede la scena
    const loop = setTimeout(() => {
      setShown(0);
      setCycle((c) => c + 1);
    }, 13000);
    return () => [...timers, loop].forEach(clearTimeout);
  }, [cycle]);

  const booked = shown > SCRIPT.length;

  return (
    <div className="grid gap-4 sm:grid-cols-[1.15fr_1fr]" aria-label="Esempio: un cliente prenota in chat e l'appuntamento entra in agenda">
      {/* Chat */}
      <div className="flex min-h-[340px] flex-col rounded-[22px] border border-line bg-white p-4 shadow-[0_18px_40px_-24px_rgba(14,90,74,0.45)]">
        <div className="mb-3 flex items-center gap-2 border-b border-line pb-3">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-mint font-display text-sm font-bold text-bottle">A</span>
          <div className="leading-tight">
            <p className="text-sm font-semibold">Salone Aurora</p>
            <p className="text-xs text-ink-soft">Assistente di prenotazione</p>
          </div>
        </div>
        <ol className="flex flex-1 flex-col gap-2 text-sm">
          {SCRIPT.slice(0, shown).map((m, i) => (
            <li
              key={i}
              className={`animate-bubble-in max-w-[85%] rounded-2xl px-3 py-2 ${
                m.from === "cliente"
                  ? "self-end rounded-br-md bg-bottle text-white"
                  : "self-start rounded-bl-md bg-paper text-ink"
              }`}
            >
              {m.text}
            </li>
          ))}
        </ol>
      </div>

      {/* Agenda */}
      <div className="rounded-[22px] bg-mint p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <p className="font-display font-bold">Sabato</p>
          <p className="text-xs text-bottle">Marco, barbiere</p>
        </div>
        <div className="relative" style={{ height: ROW * (HOURS.length - 1) }}>
          {HOURS.map((h, i) => (
            <div key={h} className="absolute inset-x-0 flex items-start gap-2" style={{ top: i * ROW }}>
              <span className="w-9 -translate-y-2 text-[11px] text-bottle/70">{h}</span>
              <span className="mt-0 h-px flex-1 bg-bottle/15" />
            </div>
          ))}
          <Block top={0} height={ROW / 2} label="9:00 Luca, taglio" />
          <Block top={ROW * 0.5} height={ROW} label="9:30 Andrea, taglio e barba" />
          <Block top={ROW * 3} height={ROW / 2} label="12:00 Davide, taglio" />
          {booked && (
            <div
              className="animate-slot-in absolute left-11 right-0 rounded-lg border-2 border-cherry bg-white px-2 py-1 text-xs"
              style={{ top: ROW * 1.5 + 1, height: ROW - 2 }}
            >
              <span className="font-semibold text-cherry">Nuovo</span> 10:30 taglio e barba
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Block({ top, height, label }: { top: number; height: number; label: string }) {
  return (
    <div
      className="absolute left-11 right-0 truncate rounded-lg bg-white/70 px-2 py-1 text-xs text-ink-soft"
      style={{ top: top + 1, height: height - 2 }}
    >
      {label}
    </div>
  );
}

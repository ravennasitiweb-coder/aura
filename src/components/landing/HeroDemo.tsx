"use client";

import { useEffect, useState } from "react";

// Scena dell'hero: a sinistra il telefono del cliente sulla pagina di
// prenotazione del salone, a destra l'agenda che si aggiorna.
// Passi: 1 servizio, 2 giorno, 3 orario, 4 confermato, 5 in agenda.
const STEPS = 5;
const DELAYS = [700, 1900, 3100, 4500, 5300];

const HOURS = ["9:00", "10:00", "11:00", "12:00", "13:00"];
const ROW = 44; // pixel per ora

export function HeroDemo() {
  const [step, setStep] = useState(0);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const t = setTimeout(() => setStep(STEPS), 0);
      return () => clearTimeout(t);
    }
    const timers = DELAYS.map((d, i) => setTimeout(() => setStep(i + 1), d));
    // Riparte dopo una pausa, così chi arriva tardi vede la scena
    const loop = setTimeout(() => {
      setStep(0);
      setCycle((c) => c + 1);
    }, 12000);
    return () => [...timers, loop].forEach(clearTimeout);
  }, [cycle]);

  const confirmed = step >= 4;

  return (
    <div className="grid gap-4 sm:grid-cols-[1.15fr_1fr]" aria-label="Esempio: un cliente prenota dalla pagina del salone e l'appuntamento entra in agenda">
      {/* Telefono del cliente */}
      <div className="flex min-h-[340px] flex-col overflow-hidden rounded-[22px] border border-line bg-white shadow-[0_18px_40px_-24px_rgba(14,90,74,0.45)]">
        <div className="bg-bottle px-4 pb-3 pt-4 text-white">
          <p className="text-[11px] text-mint">Prenota online</p>
          <p className="font-display font-bold">Salone Aurora</p>
        </div>

        {confirmed ? (
          <div className="animate-bubble-in flex flex-1 flex-col items-center justify-center p-4 text-center">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-mint text-bottle" aria-hidden="true">✓</span>
            <p className="mt-2 font-display font-bold">Prenotazione confermata</p>
            <p className="text-sm text-ink-soft">Sabato alle 10:30 con Marco</p>
          </div>
        ) : (
          <div className="flex-1 space-y-3 p-4 text-sm">
            <div>
              <p className="mb-1.5 text-xs text-ink-soft">Servizio</p>
              <div className={`flex justify-between rounded-lg border px-3 py-2 ${step >= 1 ? "border-bottle bg-mint" : "border-line"}`}>
                <span className="font-semibold">Taglio e barba</span>
                <span>37 €</span>
              </div>
            </div>
            {step >= 1 && (
              <div className="animate-bubble-in">
                <p className="mb-1.5 text-xs text-ink-soft">Giorno</p>
                <div className="flex gap-1.5">
                  {["Gio 5", "Ven 6", "Sab 7"].map((d) => (
                    <span
                      key={d}
                      className={`flex-1 rounded-lg border py-1.5 text-center text-xs ${
                        step >= 2 && d === "Sab 7" ? "border-bottle bg-bottle text-white" : "border-line"
                      }`}
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {step >= 2 && (
              <div className="animate-bubble-in">
                <p className="mb-1.5 text-xs text-ink-soft">Orari liberi</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {["10:30", "11:30", "12:00", "12:30"].map((t) => (
                    <span
                      key={t}
                      className={`rounded-lg border py-1.5 text-center text-xs font-semibold ${
                        step >= 3 && t === "10:30" ? "border-bottle bg-bottle text-white" : "border-line text-bottle"
                      }`}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Agenda del salone */}
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
          {step >= STEPS && (
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

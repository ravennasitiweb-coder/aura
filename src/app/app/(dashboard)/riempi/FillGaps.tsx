"use client";

import { useState } from "react";

type Day = "oggi" | "domani";
type Lapsed = { key: string; name: string; phone: string; lastVisit: string };

/** Numero per wa.me: solo cifre, con prefisso Italia se manca */
function waNumber(phone: string) {
  let d = phone.replace(/\D/g, "").replace(/^00/, "");
  if (d.length === 10 && d.startsWith("3")) d = `39${d}`;
  return d;
}

const weeksAgo = (iso: string) => Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / (7 * 86_400_000)));

export function FillGaps({ salonName, slug, days, lapsed }: { salonName: string; slug: string; days: Record<Day, string[]>; lapsed: Lapsed[] }) {
  const [day, setDay] = useState<Day>(days.oggi.length ? "oggi" : "domani");
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [story, setStory] = useState<"idle" | "busy" | "error">("idle");
  const times = days[day];
  const link = typeof location === "undefined" ? `/p/${slug}` : `${location.origin}/p/${slug}`;
  const shown = times.slice(0, 4).join(", ");

  const message = (name: string) =>
    `Ciao ${name.split(" ")[0]}! Qui ${salonName}: ${day} ho ancora posto alle ${shown}. Se ti fa comodo prenoti in un attimo da qui: ${link}`;

  async function shareStory() {
    setStory("busy");
    try {
      const res = await fetch(`/app/riempi/storia?giorno=${day}`);
      if (!res.ok) throw new Error();
      const file = new File([await res.blob()], `posti-liberi-${day}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: link });
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(file);
        a.download = file.name;
        a.click();
      }
      setStory("idle");
    } catch (e) {
      // Chiudere il menu di condivisione non è un errore
      setStory(e instanceof DOMException && e.name === "AbortError" ? "idle" : "error");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2" role="tablist">
        {(["oggi", "domani"] as Day[]).map((d) => (
          <button
            key={d}
            type="button"
            role="tab"
            aria-selected={day === d}
            onClick={() => setDay(d)}
            className={`rounded-full px-5 py-2 font-semibold capitalize ${day === d ? "bg-bottle text-white" : "border border-line bg-white"}`}
          >
            {d} · {days[d].length} liberi
          </button>
        ))}
      </div>

      {times.length === 0 ? (
        <p className="rounded-2xl bg-mint p-6 font-semibold text-bottle-dark">Agenda piena {day}. Ottimo lavoro!</p>
      ) : (
        <>
          <section className="rounded-2xl bg-bottle-dark p-6 text-white">
            <p className="text-sm text-white/70">Posti liberi {day}</p>
            <p className="mt-1 font-display text-3xl font-bold">{times.join(" · ")}</p>
            <button
              type="button"
              onClick={shareStory}
              disabled={story === "busy"}
              className="mt-5 rounded-full bg-gradient-to-r from-[#f58529] via-[#dd2a7b] to-[#8134af] px-6 py-3 font-bold text-white disabled:opacity-60"
            >
              {story === "busy" ? "Preparo la storia…" : "Crea la storia Instagram"}
            </button>
            {story === "error" && <p className="mt-2 text-sm text-mint">Non sono riuscito a crearla. Riprova.</p>}
            <p className="mt-2 text-sm text-white/60">Un&apos;immagine pronta con i tuoi orari liberi: pubblicala e aggiungi il link alla tua pagina.</p>
          </section>

          <section className="rounded-2xl border border-line bg-white p-6">
            <h2 className="font-display text-xl font-bold">Clienti da richiamare ({lapsed.length})</h2>
            <p className="mt-1 text-sm text-ink-soft">Non vengono da più di 5 settimane e non hanno appuntamenti. Un tocco e si apre WhatsApp col messaggio pronto.</p>
            {lapsed.length === 0 ? (
              <p className="mt-4 text-ink-soft">Nessuno per ora: servono clienti con telefono e almeno una visita passata.</p>
            ) : (
              <ul className="mt-4 divide-y divide-line">
                {lapsed.map((c) => (
                  <li key={c.key} className="flex items-center justify-between gap-3 py-3">
                    <span>
                      <span className="font-semibold">{c.name}</span>
                      <span className="block text-sm text-ink-soft">ultima visita {weeksAgo(c.lastVisit)} settimane fa</span>
                    </span>
                    <a
                      href={`https://wa.me/${waNumber(c.phone)}?text=${encodeURIComponent(message(c.name))}`}
                      target="_blank"
                      rel="noopener"
                      onClick={() => setSent((s) => new Set(s).add(c.key))}
                      className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${sent.has(c.key) ? "bg-mint text-bottle-dark" : "bg-[#25d366] text-white"}`}
                    >
                      {sent.has(c.key) ? "Scritto ✓" : "WhatsApp"}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

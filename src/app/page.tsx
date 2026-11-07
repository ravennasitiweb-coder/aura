import Link from "next/link";
import { Logo } from "@/components/Logo";
import { HeroDemo } from "@/components/landing/HeroDemo";
import { BUSINESS_TYPES } from "@/lib/business-types";
import { PLANS } from "@/lib/plans";

const PAINS = ["Il telefono squilla mentre lavori.", "WhatsApp alle 23.", "Il cliente che non si presenta."];

const STEPS = [
  { title: "Fai una foto all'agenda", text: "L'AI la trasforma in appuntamenti." },
  { title: "Condividi il link", text: "Su Instagram, Google Maps e WhatsApp." },
  { title: "Ricevi prenotazioni", text: "Arrivano in agenda da sole, giorno e notte." },
];

const FEATURES = [
  { title: "Prenotazioni h24", text: "Solo negli orari davvero liberi." },
  { title: "Promemoria automatici", text: "Meno clienti che non si presentano." },
  { title: "Foto, vocale o WhatsApp", text: "Incolla un messaggio o detta: l'appuntamento si crea da solo." },
  { title: "Tavoli e sala", text: "Per ristoranti: posti, turni e pianta." },
  { title: "Riempi i buchi", text: "Storia Instagram dei posti liberi e WhatsApp ai clienti persi." },
  { title: "Dati in Europa", text: "Server in UE, GDPR rispettato." },
  { title: "Segretaria WhatsApp", text: "Risponde ai tuoi clienti su WhatsApp, giorno e notte, con gli orari liberi veri.", soon: true },
];

const FAQ = [
  { q: "Devo installare qualcosa?", a: "No, funziona dal browser di telefono e computer." },
  { q: "Posso prendere ancora appuntamenti al telefono?", a: "Sì, li aggiungi in agenda in pochi secondi." },
  { q: "Come funziona il mese gratis?", a: "Provi tutto per 30 giorni. Puoi disdire quando vuoi, senza vincoli." },
  { q: "Ci sono commissioni sulle prenotazioni?", a: "No. Paghi solo l'abbonamento mensile." },
  { q: "Come funziona la garanzia?", a: "Se in un mese le prenotazioni online non valgono almeno quanto l'abbonamento, il mese dopo è gratis. Lo vedi nel contatore in Panoramica." },
];

const CTA = "Inizia gratis";

export default function Home() {
  return (
    <>
      {/* Hero scuro, ad alto contrasto */}
      <div className="bg-bottle-dark text-white">
        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
          <Logo className="text-white" />
          <nav aria-label="Principale" className="flex items-center gap-6 text-sm">
            <a href="#prezzi" className="hidden text-white/70 hover:text-white md:inline">Prezzi</a>
            <Link href="/accedi" className="text-white/70 hover:text-white">Accedi</Link>
            <Link href="/registrati" className="rounded-full bg-mint px-4 py-2 font-semibold text-bottle-dark hover:bg-white">
              {CTA}
            </Link>
          </nav>
        </header>

        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pb-24 pt-10 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-16">
          <div>
            <p className="inline-block rounded-full bg-mint px-4 py-1.5 text-sm font-bold text-bottle-dark">Primo mese gratis</p>
            <h1 className="mt-6 font-display text-[3rem] font-extrabold leading-[0.95] tracking-[-0.04em] sm:text-6xl xl:text-[5.2rem]">
              Prenotano da soli.
              <span className="block text-mint-deep">Tu lavori.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg text-white/80">
              Non cambiare abitudini: fai una foto alla tua agenda, al resto pensa SmartBooking.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href="/registrati" className="rounded-full bg-mint px-8 py-4 text-lg font-bold text-bottle-dark hover:bg-white">
                {CTA}
              </Link>
              <Link href="/demo" className="font-semibold text-white underline-offset-4 hover:underline">
                Guarda la demo
              </Link>
            </div>
            <p className="mt-4 text-sm text-white/60">Da 15 € al mese. Nessuna commissione.</p>
          </div>
          <div className="text-ink">
            <HeroDemo />
          </div>
        </section>
      </div>

      <main>
        {/* Problema: tre frasi secche */}
        <section className="border-b border-line bg-white">
          <ul className="mx-auto grid max-w-6xl gap-6 px-4 py-14 sm:px-6 md:grid-cols-3">
            {PAINS.map((p) => (
              <li key={p} className="font-display text-2xl font-bold leading-tight text-ink/40 line-through decoration-cherry decoration-[3px] sm:text-3xl">
                {p}
              </li>
            ))}
          </ul>
        </section>

        {/* Come funziona: sequenza vera, quindi numerata */}
        <section className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6">
          <h2 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">Pronto in 15 minuti</h2>
          <ol className="mt-12 grid gap-10 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <span className="font-display text-7xl font-extrabold leading-none text-mint-deep">{i + 1}</span>
                <h3 className="mt-4 text-xl font-bold">{s.title}</h3>
                <p className="mt-1 text-ink-soft">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Funzioni */}
        <section className="bg-mint">
          <div className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6">
            <h2 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">Lavori come sempre. Lui fa il resto.</h2>
            <dl className="mt-12 grid gap-px overflow-hidden rounded-3xl bg-bottle/15 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div key={f.title} className={"soon" in f ? "flex flex-wrap items-center gap-x-6 gap-y-1 bg-bottle-dark p-7 text-white sm:col-span-2 lg:col-span-3" : "bg-mint p-7"}>
                  <dt className={`font-display text-2xl font-bold ${"soon" in f ? "text-white" : "text-bottle-dark"}`}>{f.title}{"soon" in f && <span className="ml-3 rounded-full bg-mint px-3 py-1 align-middle text-xs font-bold text-bottle-dark">In arrivo</span>}</dt>
                  <dd className={"soon" in f ? "text-white/75" : "mt-1 text-ink-soft"}>{f.text}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Per chi */}
        <section className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6">
          <h2 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
            {BUSINESS_TYPES.length} tipi di attività
          </h2>
          <ul className="mt-10 flex flex-wrap gap-2">
            {BUSINESS_TYPES.map((t) => (
              <li
                key={t.id}
                className={`rounded-full px-4 py-2 text-sm font-medium ${t.featured || t.tables ? "bg-bottle text-white" : "border border-line bg-white text-ink-soft"}`}
              >
                {t.label}
              </li>
            ))}
          </ul>
        </section>

        {/* Prezzi */}
        <section id="prezzi" className="scroll-mt-8 bg-bottle-dark text-white">
          <div className="mx-auto w-full max-w-4xl px-4 py-24 sm:px-6">
            <h2 className="text-center font-display text-4xl font-extrabold tracking-tight sm:text-5xl">Due piani, senza commissioni.</h2>
            <p className="mt-3 text-center text-white/70">Primo mese gratis · Se non ti ripaghi, il mese dopo è gratis · IVA esclusa</p>
            <div className="mt-12 grid gap-6 md:grid-cols-2">
              {PLANS.map((p) => (
                <div key={p.id} className={`flex flex-col rounded-3xl p-8 ${p.highlight ? "bg-mint text-bottle-dark" : "bg-white/5 ring-1 ring-white/15"}`}>
                  <h3 className="font-display text-2xl font-bold">{p.name}</h3>
                  <p className={p.highlight ? "text-bottle" : "text-white/70"}>{p.text}</p>
                  <p className="mt-6 font-display text-7xl font-extrabold leading-none tracking-tight">
                    {p.price}€<span className="text-lg font-medium"> /mese</span>
                  </p>
                  <ul className="mt-8 flex-1 space-y-2">
                    {p.items.map((it) => (
                      <li key={it} className="flex gap-2">
                        <span aria-hidden="true" className="font-bold">✓</span>
                        {it}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/registrati"
                    className={`mt-8 rounded-full px-5 py-4 text-center text-lg font-bold ${
                      p.highlight ? "bg-bottle-dark text-white hover:bg-ink" : "bg-white text-bottle-dark hover:bg-mint"
                    }`}
                  >
                    Prova gratis 30 giorni
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto w-full max-w-3xl px-4 py-24 sm:px-6">
          <h2 className="font-display text-4xl font-extrabold tracking-tight">Domande</h2>
          <div className="mt-8 divide-y divide-line border-y border-line">
            {FAQ.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold">
                  {f.q}
                  <span aria-hidden="true" className="text-2xl text-bottle transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 text-ink-soft">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Chiamata finale */}
        <section className="bg-mint">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-8 px-4 py-20 sm:px-6 md:flex-row md:items-center md:justify-between">
            <h2 className="max-w-xl font-display text-4xl font-extrabold tracking-tight text-bottle-dark sm:text-5xl">
              Se non ti fa guadagnare, non paghi.
            </h2>
            <Link href="/registrati" className="rounded-full bg-bottle-dark px-8 py-4 text-lg font-bold text-white hover:bg-ink">
              {CTA}
            </Link>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-10 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <Logo className="text-ink" />
        <div className="flex gap-6">
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>
          <span>© 2026 SmartBooking · Ravenna Siti Web</span>
        </div>
      </footer>
    </>
  );
}

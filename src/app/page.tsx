import Link from "next/link";
import { Logo } from "@/components/Logo";
import { HeroDemo } from "@/components/landing/HeroDemo";
import { BUSINESS_TYPES, typesByCategory } from "@/lib/business-types";
import { PLANS } from "@/lib/plans";

const STEPS = [
  { title: "Imposta il salone", text: "Inserisci servizi, durate, prezzi, collaboratori e orari. Bastano un quarto d'ora e il telefono." },
  { title: "Condividi il tuo link", text: "Mettilo nella bio di Instagram, su Google Maps e nel messaggio automatico di WhatsApp." },
  { title: "Ritrova tutto in agenda", text: "I clienti prenotano da soli dalla tua pagina. Gli appuntamenti compaiono già al posto giusto, con nome e telefono." },
];

// Solo funzioni che il prodotto ha davvero oggi
const FEATURES = [
  { title: "Un'agenda per ogni collaboratore", text: "Vedi la giornata di tutti a colpo d'occhio: chi è occupato, chi è libero, quando il salone è chiuso." },
  { title: "I clienti prenotano da soli, a qualsiasi ora", text: "Dalla tua pagina scelgono servizio, giorno e orario tra quelli davvero liberi, anche di notte e di domenica." },
  { title: "Mai due clienti sulla stessa poltrona", text: "Il sistema blocca un orario appena viene preso, anche se due persone prenotano nello stesso istante." },
  { title: "Orari, pause e servizi come li vuoi tu", text: "Pausa pranzo, giorni di chiusura, chi fa cosa: le prenotazioni rispettano le tue regole." },
  { title: "Dati in Europa, nel rispetto del GDPR", text: "Server in UE, consenso del cliente registrato a ogni prenotazione, e i dati restano tuoi." },
];

const FAQ = [
  { q: "Devo installare qualcosa?", a: "No. SmartBooking funziona dal browser di computer, tablet e telefono." },
  { q: "Come prenotano i miei clienti?", a: "Dalla pagina del tuo salone, che condividi su Instagram, Google e WhatsApp: scelgono servizio, giorno e orario tra quelli liberi e lasciano nome e telefono." },
  { q: "Posso continuare a prendere appuntamenti al telefono?", a: "Sì. Li inserisci in agenda in pochi secondi e il sistema li considera come tutti gli altri." },
  { q: "C'è un assistente AI?", a: "È in arrivo: risponderà ai clienti in chat usando gli stessi orari liberi della tua agenda. Lo attiveremo solo con un fornitore che tratta i dati in Europa." },
  { q: "Che fine fanno i dati dei miei clienti?", a: "Sono conservati su server nell'Unione Europea (Francoforte), non vengono venduti né usati per pubblicità." },
];

export default function Home() {
  return (
    <>
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <nav aria-label="Principale" className="flex items-center gap-6 text-sm">
          <a href="#come-funziona" className="hidden text-ink-soft hover:text-ink md:inline">Come funziona</a>
          <a href="#prezzi" className="hidden text-ink-soft hover:text-ink md:inline">Prezzi</a>
          <Link href="/accedi" className="text-ink-soft hover:text-ink">Accedi</Link>
          <Link href="/registrati" className="rounded-full bg-ink px-4 py-2 font-medium text-white hover:bg-bottle-dark">
            Crea il tuo salone
          </Link>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pb-20 pt-10 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:pt-16">
          <div>
            <h1 className="font-display text-[2.5rem] font-bold leading-[1.04] tracking-[-0.03em] sm:text-5xl xl:text-[3.6rem]">
              Il tuo salone prende appuntamenti anche quando hai le mani tra i capelli.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
              I clienti prenotano da soli dalla pagina del tuo salone, a qualsiasi ora, solo negli orari davvero liberi.
              Tu ritrovi tutto in agenda. Per parrucchieri, barbieri, estetisti, tatuatori, trainer e non solo.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/registrati" className="rounded-full bg-bottle px-6 py-3 font-semibold text-white hover:bg-bottle-dark">
                Crea il tuo salone
              </Link>
              <Link href="/demo" className="rounded-full border border-ink/20 px-6 py-3 font-semibold hover:border-ink">
                Prova la demo
              </Link>
            </div>
          </div>
          <HeroDemo />
        </section>

        {/* Problema */}
        <section className="border-y border-line bg-white">
          <p className="mx-auto max-w-4xl px-4 py-14 text-center font-display text-2xl leading-snug sm:text-3xl">
            Il telefono che squilla durante una piega. I messaggi su WhatsApp alle undici di sera.
            Due clienti sullo stesso orario. Da oggi ci pensa SmartBooking.
          </p>
        </section>

        {/* Come funziona: è una sequenza, quindi i passi sono numerati */}
        <section id="come-funziona" className="mx-auto w-full max-w-6xl scroll-mt-8 px-4 py-20 sm:px-6">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Pronto in tre passi</h2>
          <ol className="mt-10 grid gap-10 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="border-t-2 border-bottle pt-5">
                <span className="font-display text-5xl font-bold text-mint-deep">{i + 1}</span>
                <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 leading-relaxed text-ink-soft">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Funzionalità */}
        <section className="bg-mint">
          <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
                Pensato per chi lavora in piedi tutto il giorno
              </h2>
              <p className="mt-4 max-w-md leading-relaxed text-bottle-dark">
                Niente software complicati: le cose che ti servono davvero, dove ti aspetti di trovarle.
              </p>
            </div>
            <dl className="divide-y divide-bottle/15">
              {FEATURES.map((f) => (
                <div key={f.title} className="py-5 first:pt-0">
                  <dt className="font-semibold">{f.title}</dt>
                  <dd className="mt-1 leading-relaxed text-ink-soft">{f.text}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Per chi */}
        <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Su misura per il tuo mestiere</h2>
          <div className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {BUSINESS_TYPES.filter((t) => t.featured).map((t) => (
              <div key={t.id}>
                <h3 className="font-display text-xl font-bold text-bottle">{t.label}</h3>
                <p className="mt-2 leading-relaxed text-ink-soft">{t.featured!.pitch}</p>
              </div>
            ))}
          </div>

          {/* Tutte le altre attività, per categoria */}
          <div className="mt-14 border-t border-line pt-10">
            <h3 className="font-display text-xl font-bold">E molte altre attività su appuntamento</h3>
            <dl className="mt-6 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
              {typesByCategory().map(({ category, types }) => {
                const others = types.filter((t) => !t.featured);
                if (others.length === 0) return null;
                return (
                  <div key={category}>
                    <dt className="text-sm font-semibold text-bottle">{category}</dt>
                    <dd className="mt-1 leading-relaxed text-ink-soft">{others.map((t) => t.label).join(", ")}</dd>
                  </div>
                );
              })}
            </dl>
          </div>
        </section>

        {/* Prezzi */}
        <section id="prezzi" className="scroll-mt-8 border-t border-line bg-white">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Prezzi semplici, senza vincoli</h2>
            <p className="mt-3 text-ink-soft">Prezzi mensili previsti, IVA esclusa. Durante il periodo di lancio puoi usarlo gratis.</p>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {PLANS.map((p) => (
                <div
                  key={p.name}
                  className={`flex flex-col rounded-3xl p-7 ${p.highlight ? "bg-bottle text-white" : "border border-line"}`}
                >
                  <h3 className="font-display text-xl font-bold">{p.name}</h3>
                  <p className={p.highlight ? "text-mint" : "text-ink-soft"}>{p.text}</p>
                  <p className="mt-6 font-display text-5xl font-bold">
                    {p.price} €<span className="text-base font-normal"> / mese</span>
                  </p>
                  <ul className="mt-6 flex-1 space-y-2">
                    {p.items.map((it) => (
                      <li key={it} className="flex gap-2">
                        <span aria-hidden="true" className={p.highlight ? "text-mint" : "text-bottle"}>✓</span>
                        {it}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/registrati"
                    className={`mt-8 rounded-full px-5 py-3 text-center font-semibold ${
                      p.highlight ? "bg-white text-bottle hover:bg-mint" : "bg-ink text-white hover:bg-bottle-dark"
                    }`}
                  >
                    Crea il tuo salone
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto w-full max-w-3xl px-4 py-20 sm:px-6">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Domande frequenti</h2>
          <div className="mt-8 divide-y divide-line border-y border-line">
            {FAQ.map((f) => (
              <details key={f.q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                  {f.q}
                  <span aria-hidden="true" className="text-xl text-bottle transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 leading-relaxed text-ink-soft">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Chiamata finale */}
        <section className="bg-bottle text-white">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:px-6 md:flex-row md:items-center md:justify-between">
            <h2 className="max-w-xl font-display text-3xl font-bold tracking-tight">
              Imposta il tuo salone in un quarto d&apos;ora e condividi il link già oggi.
            </h2>
            <div className="flex flex-wrap gap-3">
              <Link href="/registrati" className="rounded-full bg-white px-6 py-3 font-semibold text-bottle hover:bg-mint">
                Crea il tuo salone
              </Link>
              <Link href="/demo" className="rounded-full border border-white/40 px-6 py-3 font-semibold text-white hover:border-white">
                Prova la demo
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-10 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <Logo className="text-ink" />
        <div className="flex gap-6">
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>
          <span>© 2026 SmartBooking</span>
        </div>
      </footer>
    </>
  );
}

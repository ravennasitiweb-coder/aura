import Link from "next/link";
import { Logo } from "@/components/Logo";
import { HeroDemo } from "@/components/landing/HeroDemo";

const STEPS = [
  { title: "Imposta il salone", text: "Inserisci servizi, durate, prezzi, collaboratori e orari. Bastano un quarto d'ora e il telefono." },
  { title: "Condividi il tuo link", text: "Mettilo nella bio di Instagram, su Google Maps e nel messaggio automatico di WhatsApp." },
  { title: "Ritrova tutto in agenda", text: "I clienti prenotano da soli o chiedono all'assistente. Gli appuntamenti compaiono già al posto giusto." },
];

const FEATURES = [
  { title: "Un'agenda per ogni collaboratore", text: "Vedi la giornata di tutti a colpo d'occhio e sposti un appuntamento con un tocco." },
  { title: "L'assistente capisce come scrivono i clienti", text: "\"Sabato mattina con Marco\" basta: propone solo orari davvero liberi e chiede conferma prima di prenotare." },
  { title: "Mai due clienti sulla stessa poltrona", text: "Il sistema blocca un orario appena viene preso, anche se due persone prenotano nello stesso istante." },
  { title: "Promemoria che riducono i buchi", text: "Il cliente riceve un messaggio il giorno prima e può spostare l'appuntamento senza telefonarti." },
  { title: "Dati in Europa, nel rispetto del GDPR", text: "Server in UE, consensi registrati, e i dati dei tuoi clienti restano tuoi." },
];

const AUDIENCES = [
  { title: "Parrucchieri", text: "Colori con tempi di posa, pieghe e trattamenti lunghi gestiti senza incastri impossibili." },
  { title: "Barbieri", text: "Slot da mezz'ora, taglio e barba in sequenza, clienti abituali riconosciuti al volo." },
  { title: "Estetisti", text: "Trattamenti viso e corpo, cabine e pacchetti, con le preparazioni già calcolate nella durata." },
];

// Prezzi segnaposto: da definire prima del lancio (Fase 6)
const PLANS = [
  { name: "Solo", price: 19, text: "Per chi lavora da solo.", items: ["1 collaboratore", "Pagina di prenotazione", "Promemoria email"] },
  { name: "Salone", price: 39, text: "Il piano più scelto.", items: ["Fino a 5 collaboratori", "Assistente AI in chat", "Promemoria email e SMS"], highlight: true },
  { name: "Studio", price: 69, text: "Per saloni grandi.", items: ["Collaboratori illimitati", "Assistente AI in chat", "Statistiche e più sedi"] },
];

const FAQ = [
  { q: "Devo installare qualcosa?", a: "No. SmartBooking AI funziona dal browser di computer, tablet e telefono." },
  { q: "L'assistente può sbagliare un orario?", a: "Non può prenotare un orario occupato: controlla l'agenda vera prima di proporre e chiede sempre conferma al cliente." },
  { q: "Posso continuare a prendere appuntamenti al telefono?", a: "Sì. Li inserisci in agenda in pochi secondi e il sistema li considera come tutti gli altri." },
  { q: "Che fine fanno i dati dei miei clienti?", a: "Sono conservati su server in Unione Europea e puoi esportarli o cancellarli quando vuoi." },
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
          <Link href="/demo" className="rounded-full bg-ink px-4 py-2 font-medium text-white hover:bg-bottle-dark">
            Prova la demo
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
              SmartBooking AI risponde ai clienti in chat, trova l&apos;orario libero giusto e lo scrive in agenda.
              Per parrucchieri, barbieri ed estetisti.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/demo" className="rounded-full bg-bottle px-6 py-3 font-semibold text-white hover:bg-bottle-dark">
                Prova la demo
              </Link>
              <a href="#come-funziona" className="rounded-full border border-ink/20 px-6 py-3 font-semibold hover:border-ink">
                Scopri come funziona
              </a>
            </div>
          </div>
          <HeroDemo />
        </section>

        {/* Problema */}
        <section className="border-y border-line bg-white">
          <p className="mx-auto max-w-4xl px-4 py-14 text-center font-display text-2xl leading-snug sm:text-3xl">
            Il telefono che squilla durante una piega. I messaggi su WhatsApp alle undici di sera.
            Il cliente che non si presenta. Da oggi ci pensa SmartBooking AI.
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
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {AUDIENCES.map((a) => (
              <div key={a.title}>
                <h3 className="font-display text-2xl font-bold text-bottle">{a.title}</h3>
                <p className="mt-2 leading-relaxed text-ink-soft">{a.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Prezzi */}
        <section id="prezzi" className="scroll-mt-8 border-t border-line bg-white">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Prezzi semplici, senza vincoli</h2>
            <p className="mt-3 text-ink-soft">14 giorni di prova gratuita. Prezzi mensili, IVA esclusa.</p>
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
                    href="/demo"
                    className={`mt-8 rounded-full px-5 py-3 text-center font-semibold ${
                      p.highlight ? "bg-white text-bottle hover:bg-mint" : "bg-ink text-white hover:bg-bottle-dark"
                    }`}
                  >
                    Prova la demo
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
              Guarda l&apos;assistente prenotare in un salone di prova.
            </h2>
            <Link href="/demo" className="rounded-full bg-white px-6 py-3 font-semibold text-bottle hover:bg-mint">
              Apri la demo
            </Link>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-10 text-sm text-ink-soft sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <Logo className="text-ink" />
        <div className="flex gap-6">
          <a href="#" className="hover:text-ink">Privacy</a>
          <a href="#" className="hover:text-ink">Termini di servizio</a>
          <span>© 2026 SmartBooking AI</span>
        </div>
      </footer>
    </>
  );
}

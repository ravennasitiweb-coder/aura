import type { Metadata } from "next";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = { title: "Informativa sulla privacy — SmartBooking" };

// ATTENZIONE: testo di partenza da far verificare a un consulente privacy
// prima del lancio commerciale (titolare, responsabili, tempi di conservazione).

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Logo />
      <h1 className="mt-10 font-display text-3xl font-bold tracking-tight">Informativa sulla privacy</h1>
      <div className="mt-6 space-y-5 leading-relaxed text-ink-soft [&_h2]:mt-8 [&_h2]:font-semibold [&_h2]:text-ink">
        <p>
          Questa informativa riguarda i dati che inserisci quando prenoti un appuntamento in un salone tramite SmartBooking.
        </p>

        <h2>Chi tratta i tuoi dati</h2>
        <p>
          Il <strong>titolare del trattamento</strong> è il salone presso cui prenoti. SmartBooking fornisce al salone il
          servizio di prenotazione e tratta i dati per suo conto, come <strong>responsabile del trattamento</strong>.
        </p>

        <h2>Quali dati e perché</h2>
        <p>
          Nome, telefono ed eventualmente email, insieme ai dettagli dell&apos;appuntamento. Servono solo a gestire la
          prenotazione: confermarla, ricordartela e contattarti in caso di cambiamenti. La base giuridica è l&apos;esecuzione
          della tua richiesta di prenotazione.
        </p>

        <h2>Dove sono conservati</h2>
        <p>Su server nell&apos;Unione Europea (Francoforte). I dati non vengono venduti né usati per pubblicità.</p>
        <p>
          Fornitori che trattano dati per conto del servizio: Supabase (database, UE), Vercel (sito), Resend (email), Stripe
          (pagamenti degli abbonamenti) e Cloudflare Turnstile (protezione dai bot nella pagina di prenotazione). L&apos;assistente
          di configurazione usato dalle attività si appoggia a Groq: riceve solo la descrizione dell&apos;attività e i nomi dei
          tavoli scritti dal titolare, mai i dati dei clienti che prenotano.
        </p>

        <h2>Per quanto tempo</h2>
        <p>Per il tempo necessario a gestire il rapporto con il salone, salvo diversi obblighi di legge.</p>

        <h2>I tuoi diritti</h2>
        <p>
          Puoi chiedere in ogni momento di vedere, correggere o cancellare i tuoi dati, rivolgendoti al salone presso cui hai
          prenotato. Hai anche il diritto di presentare reclamo al Garante per la protezione dei dati personali.
        </p>
      </div>
    </div>
  );
}

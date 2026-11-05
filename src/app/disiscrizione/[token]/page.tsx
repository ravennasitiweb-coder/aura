import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { Unsubscribe } from "./Unsubscribe";

export const metadata: Metadata = { title: "Disiscrizione — SmartBooking", robots: { index: false } };

// Nessuna azione all'apertura del link: serve un clic (i filtri antispam
// aprono i link delle email da soli)
export default function UnsubscribePage({ params }: PageProps<"/disiscrizione/[token]">) {
  return (
    <div className="mx-auto min-h-screen max-w-lg px-4 py-8">
      <Logo />
      <div className="mt-8 rounded-2xl border border-line bg-white p-6">
        <h1 className="font-display text-2xl font-bold">Non ricevere più offerte e richiami</h1>
        <p className="mt-2 text-ink-soft">
          Continuerai a ricevere solo le comunicazioni sui tuoi appuntamenti (conferme e promemoria).
        </p>
        <Suspense fallback={null}>
          <UnsubscribeWithToken params={params} />
        </Suspense>
      </div>
    </div>
  );
}

async function UnsubscribeWithToken({ params }: { params: PageProps<"/disiscrizione/[token]">["params"] }) {
  const { token } = await params;
  return <Unsubscribe token={token} />;
}

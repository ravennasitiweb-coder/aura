import { ShareWhatsApp } from "@/components/app/ShareWhatsApp";
import type { Metadata } from "next";
import QRCode from "qrcode";
import { Suspense } from "react";
import { PrintButton } from "@/components/app/PrintButton";
import { getCurrentSalon } from "@/lib/auth";
import { SITE_URL } from "@/lib/email";

export const metadata: Metadata = { title: "QR code — SmartBooking" };

export default function QrPage() {
  return (
    <Suspense fallback={<p className="text-ink-soft">Caricamento…</p>}>
      <Qr />
    </Suspense>
  );
}

async function Qr() {
  const { salon } = await getCurrentSalon();
  const url = `${SITE_URL}/p/${salon.slug}`;
  // SVG: resta nitido a qualsiasi dimensione di stampa
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0e5a4a", light: "#ffffff" } });

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h1 className="font-display text-3xl font-bold tracking-tight">QR code per la vetrina</h1>
        <p className="mt-1 max-w-2xl text-ink-soft">
          Stampalo e mettilo in vetrina, sul bancone o sui biglietti da visita: inquadrandolo con il telefono, i clienti aprono la
          tua pagina di prenotazione.
        </p>
        <div className="mt-4 flex flex-wrap gap-2"><PrintButton /><ShareWhatsApp path={`/p/${salon.slug}`} name={salon.name} /></div>
      </div>

      {/* Il cartello da stampare */}
      <div className="mx-auto max-w-md rounded-3xl border-2 border-bottle bg-white p-8 text-center print:border-0">
        <p className="text-sm font-semibold text-bottle">Prenota online</p>
        <h2 className="mt-1 font-display text-3xl font-bold">{salon.name}</h2>
        <div className="mx-auto mt-6 w-64" aria-label={`QR code che porta a ${url}`} role="img" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="mt-6 text-lg font-semibold">Inquadra con la fotocamera</p>
        <p className="mt-1 text-sm text-ink-soft">oppure vai su {url.replace("https://", "")}</p>
        <p className="mt-6 text-xs text-chrome">Prenotazioni 24 ore su 24</p>
      </div>
    </div>
  );
}

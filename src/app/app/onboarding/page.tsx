import type { Metadata } from "next";
import { OnboardingForm } from "./OnboardingForm";

export const metadata: Metadata = { title: "Imposta il tuo salone — SmartBooking" };

export default function OnboardingPage() {
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="font-display text-3xl font-bold tracking-tight">Imposta il tuo salone</h1>
      <p className="mt-2 mb-8 text-ink-soft">Ti servono solo il nome e l&apos;indirizzo della tua pagina di prenotazione.</p>
      <OnboardingForm />
    </div>
  );
}

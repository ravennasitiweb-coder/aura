import type { Metadata } from "next";
import { OnboardingForm } from "./OnboardingForm";

export const metadata: Metadata = { title: "Imposta la tua attività — SmartBooking" };

export default function OnboardingPage() {
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="font-display text-3xl font-bold tracking-tight">Imposta la tua attività</h1>
      <p className="mt-2 mb-8 text-ink-soft">Scegli il tipo di attività, il nome e l&apos;indirizzo della pagina dove i clienti prenoteranno.</p>
      <OnboardingForm />
    </div>
  );
}

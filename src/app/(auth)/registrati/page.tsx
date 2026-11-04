import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";
import { signUp } from "../actions";

export const metadata: Metadata = { title: "Crea il tuo account — SmartBooking" };

export default function SignUpPage() {
  return (
    <>
      <h1 className="font-display text-3xl font-bold tracking-tight">Crea il tuo account</h1>
      <p className="mt-2 mb-8 text-ink-soft">Dopo la registrazione imposterai il tuo salone in pochi minuti.</p>
      <AuthForm
        action={signUp}
        submitLabel="Crea account"
        pendingLabel="Creazione in corso…"
        passwordHint="Almeno 8 caratteri."
        footer={{ text: "Hai già un account?", linkLabel: "Accedi", href: "/accedi" }}
      />
    </>
  );
}

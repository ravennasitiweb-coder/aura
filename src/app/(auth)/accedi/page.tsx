import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth/AuthForm";
import { signIn } from "../actions";

export const metadata: Metadata = { title: "Accedi — SmartBooking" };

export default function SignInPage() {
  return (
    <>
      <h1 className="font-display text-3xl font-bold tracking-tight">Accedi</h1>
      <p className="mt-2 mb-8 text-ink-soft">Entra nell&apos;agenda del tuo salone.</p>
      {/* Suspense: il modulo legge l'indirizzo della pagina (?next=) */}
      <Suspense fallback={null}>
      <AuthForm
        action={signIn}
        submitLabel="Accedi"
        pendingLabel="Accesso in corso…"
        footer={{ text: "Non hai ancora un account?", linkLabel: "Registrati", href: "/registrati" }}
      />
      </Suspense>
    </>
  );
}

"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; message?: string; email?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readCredentials(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  return { email, password };
}

// Traduce i messaggi di Supabase in italiano semplice
function translateAuthError(message: string) {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email o password non corretti.";
  if (m.includes("email not confirmed")) return "Prima conferma l'email: apri il link che ti abbiamo inviato.";
  if (m.includes("already registered")) return "Esiste già un account con questa email. Prova ad accedere.";
  if (m.includes("rate limit") || m.includes("too many")) return "Troppi tentativi. Aspetta qualche minuto e riprova.";
  if (m.includes("password")) return "La password non è abbastanza sicura: usa almeno 8 caratteri, con lettere e numeri.";
  return "Non è stato possibile completare l'operazione. Riprova tra poco.";
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const { email, password } = readCredentials(formData);
  if (!EMAIL_RE.test(email)) return { error: "Inserisci un indirizzo email valido.", email };
  if (password.length < 8) return { error: "La password deve avere almeno 8 caratteri.", email };

  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback?next=/app` },
  });
  if (error) return { error: translateAuthError(error.message), email };

  // Se la conferma email è disattivata, la sessione è già attiva
  if (data.session) redirect("/app");

  return { message: `Ti abbiamo inviato un'email a ${email}. Apri il link per attivare l'account.` };
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const { email, password } = readCredentials(formData);
  if (!email || !password) return { error: "Inserisci email e password.", email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: translateAuthError(error.message), email };

  redirect("/app");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

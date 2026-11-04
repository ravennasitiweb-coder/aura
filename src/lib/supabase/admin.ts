import "server-only";
import { createClient } from "@supabase/supabase-js";

// Client con la chiave SEGRETA di Supabase: salta la Row Level Security.
// Usato SOLO dove non c'è un utente loggato ma il server deve scrivere,
// cioè il webhook di Stripe. Mai importarlo in componenti del browser.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Manca SUPABASE_SECRET_KEY: necessaria per ricevere i pagamenti da Stripe.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

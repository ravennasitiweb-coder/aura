import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { supabaseEnv } from "./env";

// Client per il codice che gira sul server (pagine, Server Actions, route).
// Legge la sessione dell'utente dai cookie, così la Row Level Security
// sa sempre chi sta facendo la richiesta.
export async function createClient() {
  // La libreria di Supabase legge l'ora corrente (scadenza della sessione):
  // connection() fa girare questo codice solo su richieste vere, non durante
  // la preparazione anticipata delle pagine, dove Next.js lo vieta.
  await connection();
  const { url, key } = supabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Chiamato da una pagina server: lì i cookie sono in sola lettura.
          // Il rinnovo della sessione lo farà il proxy (prossimo passo).
        }
      },
    },
  });
}

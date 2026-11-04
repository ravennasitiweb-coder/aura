import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// "Data Access Layer": l'unico punto da cui pagine e azioni leggono
// l'utente e il suo salone. Se non c'è un utente valido, rimanda al login.
// cache() evita di ripetere le stesse richieste più volte nella stessa pagina.

export type Salon = { id: string; name: string; slug: string; city: string | null };
export type Role = "owner" | "staff";

export const requireUser = cache(async () => {
  const supabase = await createClient();
  // getUser() verifica la sessione con Supabase: non si fida del solo cookie
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/accedi");
  return { supabase, user: data.user };
});

// Il salone dell'utente (per ora uno solo per utente).
// Se non ne ha ancora uno, lo manda a crearlo.
export const getCurrentSalon = cache(async () => {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("salon_members")
    .select("role, salon:salons (id, name, slug, city)")
    .eq("user_id", user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Impossibile leggere il salone: ${error.message}`);
  if (!data) redirect("/app/onboarding");
  return { supabase, user, role: data.role as Role, salon: data.salon as unknown as Salon };
});

// Per le azioni che modificano i dati: solo il titolare.
// La stessa regola è applicata anche dal database (RLS).
export async function requireOwner() {
  const ctx = await getCurrentSalon();
  if (ctx.role !== "owner") throw new Error("Solo il titolare può modificare queste impostazioni.");
  return ctx;
}

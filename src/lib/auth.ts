import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// "Data Access Layer": l'unico punto da cui pagine e azioni leggono
// l'utente e il suo salone. Se non c'è un utente valido, rimanda al login.
// cache() evita di ripetere le stesse richieste più volte nella stessa pagina.

export type Salon = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  business_type: string;
  cancel_hours: number;
  reminders_enabled: boolean;
  daily_summary: boolean;
  recall_days: number | null;
  google_review_url: string | null;
};
export type Role = "owner" | "staff";

export const requireUser = cache(async () => {
  const supabase = await createClient();
  // getUser() verifica la sessione con Supabase: non si fida del solo cookie
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/accedi");
  return { supabase, user: data.user };
});

/** Cookie con l'attività scelta, per chi ne gestisce più di una */
export const SALON_COOKIE = "sb_salon";

// L'attività su cui si sta lavorando: quella scelta nel cookie, se l'utente
// ne è davvero membro, altrimenti la prima. Se non ne ha, la fa creare.
export const getCurrentSalon = cache(async () => {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("salon_members")
    .select("role, salon:salons (id, name, slug, city, business_type, cancel_hours, reminders_enabled, daily_summary, recall_days, google_review_url)")
    .eq("user_id", user.id)
    .order("created_at");
  if (error) throw new Error(`Impossibile leggere il salone: ${error.message}`);
  if (!data || data.length === 0) redirect("/app/onboarding");
  const chosen = (await cookies()).get(SALON_COOKIE)?.value;
  const row = data.find((m) => (m.salon as unknown as Salon).id === chosen) ?? data[0];
  const salons = data.map((m) => m.salon as unknown as Salon);
  return { supabase, user, role: row.role as Role, salon: row.salon as unknown as Salon, salons };
});

// Per le azioni che modificano i dati: solo il titolare.
// La stessa regola è applicata anche dal database (RLS).
export async function requireOwner() {
  const ctx = await getCurrentSalon();
  if (ctx.role !== "owner") throw new Error("Solo il titolare può modificare queste impostazioni.");
  return ctx;
}

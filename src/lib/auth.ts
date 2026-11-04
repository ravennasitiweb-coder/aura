import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// "Data Access Layer": l'unico punto da cui le pagine leggono
// l'utente e i suoi saloni. Se non c'è un utente valido, rimanda al login.

export type Membership = {
  role: "owner" | "staff";
  salon: { id: string; name: string; slug: string; city: string | null };
};

export async function requireUser() {
  const supabase = await createClient();
  // getUser() verifica la sessione con Supabase: non si fida del solo cookie
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/accedi");
  return { supabase, user: data.user };
}

export async function getMemberships(): Promise<Membership[]> {
  const { supabase } = await requireUser();
  // La RLS restituisce solo i saloni di cui l'utente è membro
  const { data, error } = await supabase
    .from("salon_members")
    .select("role, salon:salons (id, name, slug, city)")
    .order("created_at");
  if (error) throw new Error(`Impossibile leggere i saloni: ${error.message}`);
  return (data ?? []) as unknown as Membership[];
}

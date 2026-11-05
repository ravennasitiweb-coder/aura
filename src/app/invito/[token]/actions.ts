"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Restituisce un messaggio d'errore, oppure porta nell'agenda se va tutto bene */
export async function acceptInvite(token: string): Promise<string | void> {
  if (!UUID_RE.test(token)) return "Invito non valido.";
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invite", { p_token: token });
  if (error) {
    if (error.code === "SB031") return "Questo invito è per un altro indirizzo email.";
    if (error.code === "28000") return "Accedi prima di accettare l'invito.";
    return "Invito non valido o scaduto. Chiedi al titolare di mandartene uno nuovo.";
  }
  redirect("/app/agenda");
}

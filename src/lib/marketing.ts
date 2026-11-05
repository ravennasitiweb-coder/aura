import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";

// Strumenti comuni ai messaggi automatici e promozionali.

export type AudienceMember = { customer_key: string; customer_name: string; customer_email: string; token: string; last_visit: string };

/** Clienti contattabili (consenso, email, non disiscritti, nessun appuntamento in arrivo) */
export async function audienceFor(client: SupabaseClient, salonId: string): Promise<AudienceMember[]> {
  const { data, error } = await client.rpc("marketing_audience", { p_salon_id: salonId });
  if (error) throw new Error(`Impossibile leggere i clienti: ${error.message}`);
  return (data ?? []) as AudienceMember[];
}

/** Riferimenti già contattati per un tipo di messaggio negli ultimi giorni */
export async function recentlyMessaged(client: SupabaseClient, salonId: string, kind: string, days: number) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data } = await client.from("message_log").select("ref").eq("salon_id", salonId).eq("kind", kind).gte("sent_at", since);
  return new Set((data ?? []).map((r) => r.ref.split("|")[0]));
}

/**
 * Invia un messaggio una sola volta: prima lo registra (il registro non
 * accetta doppioni), poi lo spedisce. Se l'invio fallisce, toglie la
 * registrazione, così il prossimo tentativo può riprovare.
 * Restituisce true solo se il messaggio è partito ora.
 */
export async function sendOnce(
  opts: { salonId: string; kind: string; ref: string; to: string; email: { subject: string; html: string; text: string } },
  admin: SupabaseClient = createAdminClient(),
) {
  const { data: logged, error } = await admin
    .from("message_log")
    .insert({ salon_id: opts.salonId, kind: opts.kind, ref: opts.ref })
    .select("id")
    .maybeSingle();
  if (error || !logged) return false; // già inviato (o registro non raggiungibile: meglio non rischiare doppioni)

  const sent = await sendEmail(opts.to, opts.email.subject, opts.email.html, opts.email.text);
  if (!sent) await admin.from("message_log").delete().eq("id", logged.id);
  return sent;
}

/** Quante email promozionali al massimo per invio: Resend gratuito ne consente 100 al giorno */
export const MAX_PROMO_PER_RUN = 40;

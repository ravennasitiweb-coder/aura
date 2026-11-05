"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { isBusinessType } from "@/lib/business-types";
import { WEEKDAYS, parsePriceToCents } from "@/lib/format";
import { slugify } from "@/lib/slug";

// Azioni di configurazione del salone.
// Il salone si ricava sempre dalla sessione sul server, mai dal modulo inviato.

export type ActionState = { error?: string; ok?: string };

const str = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const GENERIC_ERROR = "Non è stato possibile salvare. Riprova tra poco.";

// Servizi --------------------------------------------------------------

function readService(formData: FormData) {
  const name = str(formData, "name");
  const duration = Number(str(formData, "duration_min"));
  const price = parsePriceToCents(str(formData, "price"));
  if (name.length < 2 || name.length > 80) return { error: "Il nome del servizio deve avere tra 2 e 80 caratteri." };
  if (!Number.isInteger(duration) || duration < 5 || duration > 480)
    return { error: "La durata deve essere tra 5 e 480 minuti." };
  if (price === null) return { error: "Scrivi il prezzo in euro, per esempio 25 oppure 25,50." };
  return { value: { name, duration_min: duration, price_cents: price, active: formData.get("active") !== null } };
}

export async function createService(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, salon } = await requireOwner();
  const parsed = readService(formData);
  if ("error" in parsed) return { error: parsed.error };
  const { error } = await supabase.from("services").insert({ ...parsed.value, active: true, salon_id: salon.id });
  if (error) return { error: GENERIC_ERROR };
  refresh();
  return { ok: `${parsed.value.name} aggiunto.` };
}

export async function updateService(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, salon } = await requireOwner();
  const parsed = readService(formData);
  if ("error" in parsed) return { error: parsed.error };
  const { error } = await supabase
    .from("services")
    .update(parsed.value)
    .eq("id", str(formData, "id"))
    .eq("salon_id", salon.id);
  if (error) return { error: GENERIC_ERROR };
  refresh();
  return { ok: "Salvato." };
}

export async function deleteService(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, salon } = await requireOwner();
  const { error } = await supabase.from("services").delete().eq("id", str(formData, "id")).eq("salon_id", salon.id);
  // 23503: ci sono appuntamenti collegati, il database impedisce l'eliminazione
  if (error?.code === "23503")
    return { error: "Ha già degli appuntamenti: togli la spunta a \"Prenotabile\" invece di eliminarlo." };
  if (error) return { error: GENERIC_ERROR };
  refresh();
  return { ok: "Servizio eliminato." };
}

// Collaboratori --------------------------------------------------------

function readStaff(formData: FormData) {
  const name = str(formData, "name");
  const roleTitle = str(formData, "role_title");
  if (name.length < 2 || name.length > 60) return { error: "Il nome deve avere tra 2 e 60 caratteri." };
  if (roleTitle.length > 60) return { error: "Il ruolo può avere al massimo 60 caratteri." };
  return { value: { name, role_title: roleTitle || null } };
}

export async function createStaff(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, salon } = await requireOwner();
  const parsed = readStaff(formData);
  if ("error" in parsed) return { error: parsed.error };
  const { error } = await supabase.from("staff").insert({ ...parsed.value, salon_id: salon.id });
  if (error) return { error: GENERIC_ERROR };
  refresh();
  return { ok: `${parsed.value.name} aggiunto.` };
}

export async function updateStaff(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, salon } = await requireOwner();
  const parsed = readStaff(formData);
  if ("error" in parsed) return { error: parsed.error };
  const staffId = str(formData, "id");

  const { error } = await supabase
    .from("staff")
    .update({ ...parsed.value, active: formData.get("active") !== null })
    .eq("id", staffId)
    .eq("salon_id", salon.id);
  if (error) return { error: GENERIC_ERROR };

  // Servizi che sa fare: sostituisce l'elenco con quello spuntato
  const serviceIds = formData.getAll("service_ids").map(String);
  const del = await supabase.from("staff_services").delete().eq("staff_id", staffId).eq("salon_id", salon.id);
  if (del.error) return { error: GENERIC_ERROR };
  if (serviceIds.length > 0) {
    const ins = await supabase
      .from("staff_services")
      .insert(serviceIds.map((service_id) => ({ salon_id: salon.id, staff_id: staffId, service_id })));
    if (ins.error) return { error: GENERIC_ERROR };
  }

  refresh();
  return { ok: "Salvato." };
}

export async function deleteStaff(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, salon } = await requireOwner();
  const { error } = await supabase.from("staff").delete().eq("id", str(formData, "id")).eq("salon_id", salon.id);
  if (error?.code === "23503")
    return { error: "Ha già degli appuntamenti: togli la spunta a \"Riceve appuntamenti\" invece di eliminarlo." };
  if (error) return { error: GENERIC_ERROR };
  refresh();
  return { ok: "Collaboratore eliminato." };
}

// Orari di apertura ----------------------------------------------------

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function saveOpeningHours(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, salon } = await requireOwner();
  const hours: { weekday: number; opens_at: string; closes_at: string }[] = [];

  for (let day = 1; day <= 7; day++) {
    if (formData.get(`d${day}_open`) === null) continue;
    const s1 = str(formData, `d${day}_s1`);
    const e1 = str(formData, `d${day}_e1`);
    const split = formData.get(`d${day}_split`) !== null;
    const s2 = str(formData, `d${day}_s2`);
    const e2 = str(formData, `d${day}_e2`);

    if (!TIME_RE.test(s1) || !TIME_RE.test(e1) || e1 <= s1)
      return { error: `Controlla gli orari di ${WEEKDAYS[day - 1]}: l'orario di chiusura deve essere dopo l'apertura.` };
    hours.push({ weekday: day, opens_at: s1, closes_at: e1 });

    if (split) {
      if (!TIME_RE.test(s2) || !TIME_RE.test(e2) || e2 <= s2 || s2 < e1)
        return { error: `Controlla la seconda fascia di ${WEEKDAYS[day - 1]}: deve iniziare dopo la pausa e finire dopo l'inizio.` };
      hours.push({ weekday: day, opens_at: s2, closes_at: e2 });
    }
  }

  const { error } = await supabase.rpc("set_opening_hours", { p_salon_id: salon.id, p_hours: hours });
  if (error) return { error: GENERIC_ERROR };
  refresh();
  return { ok: "Orari salvati." };
}

// Clienti --------------------------------------------------------------

export async function forgetCustomer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, salon } = await requireOwner();
  const { error } = await supabase.rpc("forget_customer", { p_salon_id: salon.id, p_customer_key: str(formData, "customer_key") });
  if (error) return { error: GENERIC_ERROR };
  // Dopo la cancellazione la scheda non esiste più: si torna all'elenco
  redirect("/app/clienti");
}

// Impostazioni del salone ----------------------------------------------

export async function saveSalonSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, salon } = await requireOwner();
  const name = str(formData, "name");
  const city = str(formData, "city");
  const slug = slugify(str(formData, "slug"));
  const type = str(formData, "business_type");

  if (!isBusinessType(type)) return { error: "Scegli il tipo di attività." };
  if (name.length < 2 || name.length > 80) return { error: "Il nome deve avere tra 2 e 80 caratteri." };
  if (slug.length < 3) return { error: "L'indirizzo deve avere almeno 3 caratteri (lettere, numeri e trattini)." };

  const { error } = await supabase
    .from("salons")
    .update({ name, city: city || null, slug, business_type: type })
    .eq("id", salon.id);
  if (error) {
    if (error.code === "23505") return { error: `L'indirizzo /p/${slug} è già usato da un'altra attività.` };
    return { error: GENERIC_ERROR };
  }
  refresh();
  return { ok: "Impostazioni salvate." };
}

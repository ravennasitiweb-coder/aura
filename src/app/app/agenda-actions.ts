"use server";

import { refresh } from "next/cache";
import { isValidDate, type FreeSlot } from "@/lib/agenda";
import { getFreeSlotsFor } from "@/lib/agenda-data";
import { getCurrentSalon } from "@/lib/auth";
import type { ActionState } from "./actions";

const str = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const STATUSES = ["confirmed", "completed", "cancelled", "no_show"] as const;

// Chiamata dal modulo appuntamento ogni volta che cambi servizio, giorno o collaboratore.
// In modifica, `ignoreAppointmentId` libera l'orario dell'appuntamento che stai spostando.
export async function findFreeSlots(
  date: string,
  serviceId: string,
  staffId: string | null,
  ignoreAppointmentId?: string,
): Promise<FreeSlot[]> {
  if (!isValidDate(date) || !serviceId) return [];
  return getFreeSlotsFor(date, serviceId, staffId, ignoreAppointmentId);
}

// Stesse regole per nuovo appuntamento e modifica
function readAppointmentForm(formData: FormData) {
  const value = {
    date: str(formData, "date"),
    time: str(formData, "time"),
    serviceId: str(formData, "service_id"),
    staffId: str(formData, "staff_id"),
    name: str(formData, "customer_name"),
    phone: str(formData, "customer_phone"),
    notes: str(formData, "notes"),
  };
  if (!value.serviceId) return { error: "Scegli il servizio." };
  if (!value.staffId) return { error: "Scegli un orario libero oppure il collaboratore." };
  if (!isValidDate(value.date)) return { error: "Scegli il giorno." };
  if (!TIME_RE.test(value.time)) return { error: "Scegli l'orario." };
  if (value.name.length < 2 || value.name.length > 80) return { error: "Scrivi il nome del cliente (almeno 2 caratteri)." };
  if (value.phone.length > 30) return { error: "Il telefono è troppo lungo." };
  if (value.notes.length > 500) return { error: "Le note possono avere al massimo 500 caratteri." };
  return { value };
}

function saveError(code: string | undefined): ActionState {
  // 23P01 = il vincolo anti-sovrapposizione del database ha bloccato il salvataggio
  if (code === "23P01") return { error: "Quell'orario è già occupato per questo collaboratore. Scegline un altro." };
  if (code === "SB002") return { error: "Questo collaboratore non esegue il servizio scelto." };
  return { error: "Non è stato possibile salvare l'appuntamento. Riprova tra poco." };
}

export async function createAppointment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, salon } = await getCurrentSalon();
  const parsed = readAppointmentForm(formData);
  if ("error" in parsed) return { error: parsed.error };
  const v = parsed.value;

  const { error } = await supabase.rpc("create_appointment", {
    p_salon_id: salon.id,
    p_staff_id: v.staffId,
    p_service_id: v.serviceId,
    p_date: v.date,
    p_time: v.time,
    p_customer_name: v.name,
    p_customer_phone: v.phone || null,
    p_notes: v.notes || null,
  });
  if (error) return saveError(error.code);

  refresh();
  return { ok: `Appuntamento per ${v.name} alle ${v.time} salvato.` };
}

export async function updateAppointment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await getCurrentSalon();
  const parsed = readAppointmentForm(formData);
  if ("error" in parsed) return { error: parsed.error };
  const v = parsed.value;

  // La RLS nel database garantisce che si possano modificare solo appuntamenti del proprio salone
  const { error } = await supabase.rpc("update_appointment", {
    p_appointment_id: str(formData, "id"),
    p_staff_id: v.staffId,
    p_service_id: v.serviceId,
    p_date: v.date,
    p_time: v.time,
    p_customer_name: v.name,
    p_customer_phone: v.phone || null,
    p_notes: v.notes || null,
  });
  if (error) return saveError(error.code);

  refresh();
  return { ok: `Spostato alle ${v.time}.` };
}

export async function setAppointmentStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, salon } = await getCurrentSalon();
  const status = str(formData, "status") as (typeof STATUSES)[number];
  if (!STATUSES.includes(status)) return { error: "Stato non valido." };

  const { error } = await supabase
    .from("appointments")
    .update({ status })
    .eq("id", str(formData, "id"))
    .eq("salon_id", salon.id);

  if (error) {
    if (error.code === "23P01") return { error: "Non si può ripristinare: nel frattempo quell'orario è stato occupato." };
    return { error: "Non è stato possibile aggiornare l'appuntamento." };
  }
  refresh();
  return { ok: "Aggiornato." };
}

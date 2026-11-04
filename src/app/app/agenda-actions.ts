"use server";

import { refresh } from "next/cache";
import { isValidDate, type FreeSlot } from "@/lib/agenda";
import { getFreeSlotsFor } from "@/lib/agenda-data";
import { getCurrentSalon } from "@/lib/auth";
import type { ActionState } from "./actions";

const str = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const STATUSES = ["confirmed", "completed", "cancelled", "no_show"] as const;

// Chiamata dal modulo "Nuovo appuntamento" ogni volta che cambi servizio, giorno o collaboratore
export async function findFreeSlots(date: string, serviceId: string, staffId: string | null): Promise<FreeSlot[]> {
  if (!isValidDate(date) || !serviceId) return [];
  return getFreeSlotsFor(date, serviceId, staffId);
}

export async function createAppointment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, salon } = await getCurrentSalon();
  const date = str(formData, "date");
  const time = str(formData, "time");
  const serviceId = str(formData, "service_id");
  const staffId = str(formData, "staff_id");
  const name = str(formData, "customer_name");
  const phone = str(formData, "customer_phone");
  const notes = str(formData, "notes");

  if (!serviceId) return { error: "Scegli il servizio." };
  if (!staffId) return { error: "Scegli un orario libero oppure il collaboratore." };
  if (!isValidDate(date)) return { error: "Scegli il giorno." };
  if (!TIME_RE.test(time)) return { error: "Scegli l'orario." };
  if (name.length < 2 || name.length > 80) return { error: "Scrivi il nome del cliente (almeno 2 caratteri)." };
  if (phone.length > 30) return { error: "Il telefono è troppo lungo." };
  if (notes.length > 500) return { error: "Le note possono avere al massimo 500 caratteri." };

  const { error } = await supabase.rpc("create_appointment", {
    p_salon_id: salon.id,
    p_staff_id: staffId,
    p_service_id: serviceId,
    p_date: date,
    p_time: time,
    p_customer_name: name,
    p_customer_phone: phone || null,
    p_notes: notes || null,
  });

  if (error) {
    // 23P01 = il vincolo anti-sovrapposizione del database ha bloccato l'inserimento
    if (error.code === "23P01") return { error: "Quell'orario è già occupato per questo collaboratore. Scegline un altro." };
    if (error.code === "SB002") return { error: "Questo collaboratore non esegue il servizio scelto." };
    return { error: "Non è stato possibile salvare l'appuntamento. Riprova tra poco." };
  }

  refresh();
  return { ok: `Appuntamento per ${name} alle ${time} salvato.` };
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

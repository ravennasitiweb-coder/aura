"use server";

import { after } from "next/server";
import { isValidDate, minutesInDay, type FreeSlot } from "@/lib/agenda";
import { PUBLIC_ERRORS } from "@/lib/public-errors";
import { getPublicFreeSlots } from "@/lib/public-booking";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { notifyWaitlistForAppointment } from "@/lib/waitlist";

// Azioni del cliente sul proprio appuntamento, identificato solo dal codice
// del link personale. Le regole (scadenza, orari) le controlla il database.

export type ManageResult = { ok: true; message: string } | { ok: false; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

async function appointmentFor(token: string) {
  if (!process.env.SUPABASE_SECRET_KEY) return null;
  const { data } = await createAdminClient().from("appointments").select("id, starts_at").eq("manage_token", token).maybeSingle();
  return data ?? null;
}

export async function confirmAppointment(token: string): Promise<ManageResult> {
  if (!UUID_RE.test(token)) return { ok: false, error: "Link non valido." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_confirm", { p_token: token });
  if (error || !data) return { ok: false, error: "Non è stato possibile confermare: l'appuntamento potrebbe essere già passato o annullato." };
  return { ok: true, message: "Grazie, appuntamento confermato!" };
}

export async function cancelAppointment(token: string): Promise<ManageResult> {
  if (!UUID_RE.test(token)) return { ok: false, error: "Link non valido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("public_cancel", { p_token: token });
  if (error) return { ok: false, error: PUBLIC_ERRORS[error.code] ?? "Non è stato possibile annullare. Riprova tra poco." };

  const appt = await appointmentFor(token);
  if (appt) after(() => notifyWaitlistForAppointment(appt.id));
  return { ok: true, message: "Appuntamento annullato. Grazie per averci avvisato." };
}

export async function rescheduleSlots(token: string, date: string): Promise<FreeSlot[]> {
  if (!UUID_RE.test(token) || !isValidDate(date) || !process.env.SUPABASE_SECRET_KEY) return [];
  const { data: appt } = await createAdminClient()
    .from("appointments")
    .select("service_id, staff_id, starts_at, ends_at, salons (slug, timezone)")
    .eq("manage_token", token)
    .eq("status", "confirmed")
    .maybeSingle();
  if (!appt) return [];
  const salon = appt.salons as unknown as { slug: string; timezone: string };
  // Il suo stesso orario non conta come occupato
  const ignore = {
    staffId: appt.staff_id,
    start: minutesInDay(appt.starts_at, date, salon.timezone),
    end: minutesInDay(appt.ends_at, date, salon.timezone),
  };
  return getPublicFreeSlots(salon.slug, appt.service_id, date, appt.staff_id, ignore.end > ignore.start ? ignore : undefined);
}

export async function rescheduleAppointment(token: string, date: string, time: string): Promise<ManageResult> {
  if (!UUID_RE.test(token) || !isValidDate(date) || !TIME_RE.test(time)) return { ok: false, error: "Scegli giorno e orario." };
  // Orario di prima: dopo lo spostamento è quello che si libera
  const before = await appointmentFor(token);
  const supabase = await createClient();
  const { error } = await supabase.rpc("public_reschedule", { p_token: token, p_date: date, p_time: time });
  if (error) {
    if (error.code === "23P01") return { ok: false, error: "Qualcuno ha appena preso quell'orario. Scegline un altro." };
    return { ok: false, error: PUBLIC_ERRORS[error.code] ?? "Non è stato possibile spostare l'appuntamento." };
  }
  // L'orario lasciato libero può interessare a chi è in lista d'attesa
  if (before) after(() => notifyWaitlistForAppointment(before.id, before.starts_at));
  return { ok: true, message: `Fatto! Appuntamento spostato alle ${time}.` };
}

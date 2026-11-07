"use server";

import { refresh } from "next/cache";
import { isValidDate, nowInTimezone, timeToMinutes } from "@/lib/agenda";
import { getAgendaDay, getFreeSlotsFor } from "@/lib/agenda-data";
import { getCurrentSalon } from "@/lib/auth";
import { AI_LIMIT_MESSAGE, groqEnabled, groqJson, groqTranscribe, groqVisionJson, takeAiRequest } from "@/lib/groq";

// "Aggiungi veloce": da un messaggio WhatsApp, un vocale o la foto dell'agenda
// di carta l'AI propone gli appuntamenti; il titolare controlla e salva.

export type Captured = { name: string; phone: string; service_id: string; staff_id: string; date: string; time: string; notes: string };
export type CaptureResult = { ok: true; items: Captured[]; heard?: string } | { ok: false; error: string };

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const MAX_AUDIO = 900_000;
const MAX_PHOTO = 750_000;

export async function readBookings(formData: FormData): Promise<CaptureResult> {
  const { supabase, salon } = await getCurrentSalon();
  if (!groqEnabled()) return { ok: false, error: "L'AI non è attiva su questo sito." };

  let text = str(formData.get("text"), 3000);
  const audio = formData.get("audio");
  const photo = str(formData.get("photo"), MAX_PHOTO + 1);
  if (audio instanceof File && audio.size > MAX_AUDIO) return { ok: false, error: "Vocale troppo lungo: massimo 40 secondi." };
  if (photo && (photo.length > MAX_PHOTO || !photo.startsWith("data:image/jpeg;base64,"))) return { ok: false, error: "Foto non valida." };
  if (!text && !(audio instanceof File && audio.size > 0) && !photo) return { ok: false, error: "Scrivi, registra o fotografa qualcosa." };
  if (!(await takeAiRequest(supabase, salon.id))) return { ok: false, error: AI_LIMIT_MESSAGE };

  const today = nowInTimezone("Europe/Rome").date;
  const day = await getAgendaDay(today);
  const services = day.services.filter((s) => s.active).map((s) => ({ id: s.id, name: s.name, min: s.duration_min }));
  const staff = day.staff.filter((s) => s.active).map((s) => ({ id: s.id, name: s.name }));
  if (services.length === 0) return { ok: false, error: "Aggiungi prima almeno un servizio." };

  const weekday = new Date(`${today}T12:00:00Z`).toLocaleDateString("it-IT", { weekday: "long", timeZone: "UTC" });
  const system = [
    `Estrai appuntamenti per l'attività "${salon.name}". Oggi è ${weekday} ${today} (fuso Europe/Rome).`,
    `Servizi (usa SOLO questi id): ${JSON.stringify(services)}.`,
    `Collaboratori o tavoli (usa SOLO questi id, oppure "" se non indicato): ${JSON.stringify(staff)}.`,
    "Converti date relative (domani, giovedì) in YYYY-MM-DD e orari in HH:MM. Scegli il servizio più simile a quello richiesto.",
    "Non inventare: se manca nome o orario, salta l'appuntamento. Telefono solo se scritto.",
    'Rispondi SOLO con JSON: {"items":[{"name":"","phone":"","service_id":"","staff_id":"","date":"YYYY-MM-DD","time":"HH:MM","notes":""}]}',
  ].join("\n");

  try {
    let heard: string | undefined;
    if (audio instanceof File && audio.size > 0) {
      heard = await groqTranscribe(audio);
      text = [text, heard].filter(Boolean).join("\n");
    }
    const raw = (photo
      ? await groqVisionJson(system, `Questa è la foto di un'agenda o di un messaggio. ${text}`, photo)
      : await groqJson(system, `Testo del titolare o del cliente:\n${text}`)) as { items?: unknown };

    const serviceIds = new Set(services.map((s) => s.id));
    const staffIds = new Set(staff.map((s) => s.id));
    const items = (Array.isArray(raw.items) ? (raw.items as Record<string, unknown>[]) : [])
      .filter((x) => x && typeof x === "object")
      .map((x) => ({
        name: str(x.name, 80),
        phone: str(x.phone, 30).replace(/[^\d+ ]/g, ""),
        service_id: serviceIds.has(str(x.service_id, 40)) ? str(x.service_id, 40) : "",
        staff_id: staffIds.has(str(x.staff_id, 40)) ? str(x.staff_id, 40) : "",
        date: str(x.date, 10),
        time: str(x.time, 5),
        notes: str(x.notes, 200),
      }))
      .filter((x) => x.name.length >= 2 && isValidDate(x.date) && TIME_RE.test(x.time))
      .slice(0, 40);
    if (items.length === 0) return { ok: false, error: "Non ho trovato appuntamenti completi (nome, giorno e orario). Riprova con più dettagli." };
    return { ok: true, items, heard };
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.message === "LIMITE" ? "Limite gratuito raggiunto: riprova tra qualche minuto." : "L'AI non ha risposto. Riprova." };
  }
}

/** Salva un appuntamento proposto: se manca il collaboratore sceglie chi è libero a quell'ora */
export async function saveCaptured(item: Captured): Promise<{ ok: boolean; message: string }> {
  const { supabase, salon } = await getCurrentSalon();
  const name = str(item.name, 80);
  const time = str(item.time, 5);
  if (name.length < 2 || !isValidDate(item.date) || !TIME_RE.test(time) || !item.service_id) return { ok: false, message: "Completa nome, servizio, giorno e orario." };

  let staffId = item.staff_id;
  if (!staffId) {
    const slot = (await getFreeSlotsFor(item.date, item.service_id, null)).find((s) => s.start === timeToMinutes(time));
    if (!slot) return { ok: false, message: "A quell'ora non c'è nessuno libero: scegli un collaboratore o un altro orario." };
    staffId = slot.staffId;
  }

  const { error } = await supabase.rpc("create_appointment", {
    p_salon_id: salon.id,
    p_staff_id: staffId,
    p_service_id: item.service_id,
    p_date: item.date,
    p_time: time,
    p_customer_name: name,
    p_customer_phone: str(item.phone, 30) || null,
    p_notes: str(item.notes, 200) || null,
    p_customer_email: null,
    p_marketing: false,
  });
  if (error) {
    if (error.code === "23P01") return { ok: false, message: "Orario già occupato." };
    if (error.code === "SB002") return { ok: false, message: "Quel collaboratore non fa questo servizio." };
    return { ok: false, message: "Non salvato. Riprova." };
  }
  refresh();
  return { ok: true, message: "Salvato" };
}

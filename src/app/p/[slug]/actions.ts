"use server";

import { after } from "next/server";
import type { FreeSlot } from "@/lib/agenda";
import { emailEnabled, sendBookingConfirmation } from "@/lib/email";
import { getPublicFreeSlots } from "@/lib/public-booking";
import { createClient } from "@/lib/supabase/server";

export type BookingResult =
  | { ok: true; booking: { id: string; starts_at: string; ends_at: string; service_name: string; staff_name: string; salon_name: string } }
  | { ok: false; error: string; slotTaken?: boolean };

const ERRORS: Record<string, string> = {
  SB010: "Per prenotare devi accettare l'informativa sulla privacy.",
  SB011: "Scrivi il tuo nome (almeno 2 caratteri).",
  SB012: "Controlla il numero di telefono.",
  SB013: "Controlla l'indirizzo email.",
  SB020: "Questa attività non esiste più.",
  SB001: "Questo servizio non è più prenotabile. Ricarica la pagina.",
  SB002: "Questo operatore non è più disponibile. Scegli un altro orario.",
  SB021: "L'orario scelto è troppo vicino o già passato. Scegline un altro.",
  SB022: "Si può prenotare al massimo 90 giorni in anticipo.",
  SB023: "L'orario scelto non è più disponibile. Scegline un altro.",
  SB024: "Hai già 3 prenotazioni in arrivo qui. Per prenotarne altre, contatta direttamente l'attività.",
};

const str = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

export async function loadSlots(slug: string, serviceId: string, date: string, staffId: string | null): Promise<FreeSlot[]> {
  return getPublicFreeSlots(slug, serviceId, date, staffId);
}

export async function book(slug: string, formData: FormData): Promise<BookingResult> {
  // Campo trappola: invisibile alle persone, i bot spesso lo compilano
  if (str(formData, "website")) return { ok: false, error: "Richiesta non valida." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_book", {
    p_slug: slug,
    p_service_id: str(formData, "service_id"),
    p_staff_id: str(formData, "staff_id"),
    p_date: str(formData, "date"),
    p_time: str(formData, "time"),
    p_name: str(formData, "name"),
    p_phone: str(formData, "phone"),
    p_email: str(formData, "email") || null,
    p_privacy: formData.get("privacy") !== null,
  });

  if (error) {
    // 23P01: qualcun altro ha preso l'orario un attimo prima
    if (error.code === "23P01") return { ok: false, slotTaken: true, error: "Qualcuno ha appena prenotato questo orario. Scegline un altro." };
    return { ok: false, slotTaken: error.code === "SB023" || error.code === "SB021", error: ERRORS[error.code] ?? "Non è stato possibile prenotare. Riprova tra poco." };
  }
  const booking = data as Extract<BookingResult, { ok: true }>["booking"];

  // Email di conferma: parte dopo la risposta, così il cliente non aspetta
  const email = str(formData, "email");
  if (email && emailEnabled()) {
    after(() =>
      sendBookingConfirmation({
        to: email,
        customerName: str(formData, "name"),
        salonName: booking.salon_name,
        serviceName: booking.service_name,
        staffName: booking.staff_name,
        startsAt: booking.starts_at,
      }),
    );
  }

  return { ok: true, booking };
}

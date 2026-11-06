"use server";

import { after } from "next/server";
import type { FreeSlot } from "@/lib/agenda";
import { emailEnabled, sendBookingConfirmation } from "@/lib/email";
import { PUBLIC_ERRORS } from "@/lib/public-errors";
import { getPublicFreeSlots } from "@/lib/public-booking";
import { createClient } from "@/lib/supabase/server";
import { humanCheck } from "@/lib/turnstile";

const BOT_ERROR = "Conferma di non essere un robot (il riquadro sopra al pulsante) e riprova.";

export type BookingResult =
  | {
      ok: true;
      booking: { id: string; manage_token: string; starts_at: string; ends_at: string; service_name: string; staff_name: string; salon_name: string };
    }
  | { ok: false; error: string; slotTaken?: boolean };

export type SimpleResult = { ok: true } | { ok: false; error: string };

const str = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

export async function loadSlots(slug: string, serviceId: string, date: string, staffId: string | null, party?: number): Promise<FreeSlot[]> {
  return getPublicFreeSlots(slug, serviceId, date, staffId, undefined, party);
}

export async function book(slug: string, formData: FormData): Promise<BookingResult> {
  // Campo trappola: invisibile alle persone, i bot spesso lo compilano
  if (str(formData, "website")) return { ok: false, error: "Richiesta non valida." };
  if (!(await humanCheck(formData))) return { ok: false, error: BOT_ERROR };

  // Ristoranti: si indica il numero di persone e il tavolo lo sceglie il database
  const party = Number(str(formData, "party"));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(party ? "public_book_table" : "public_book", {
    p_slug: slug,
    p_service_id: str(formData, "service_id"),
    ...(party ? { p_party: party } : { p_staff_id: str(formData, "staff_id") }),
    p_date: str(formData, "date"),
    p_time: str(formData, "time"),
    p_name: str(formData, "name"),
    p_phone: str(formData, "phone"),
    p_email: str(formData, "email") || null,
    p_privacy: formData.get("privacy") !== null,
    p_marketing: formData.get("marketing") !== null,
  });

  if (error) {
    // 23P01: qualcun altro ha preso l'orario un attimo prima
    if (error.code === "23P01") return { ok: false, slotTaken: true, error: "Qualcuno ha appena prenotato questo orario. Scegline un altro." };
    return {
      ok: false,
      slotTaken: ["SB021", "SB023", "SB025", "SB031"].includes(error.code),
      error: PUBLIC_ERRORS[error.code] ?? "Non è stato possibile prenotare. Riprova tra poco.",
    };
  }
  const booking = data as Extract<BookingResult, { ok: true }>["booking"];
  if (party) booking.staff_name = `tavolo per ${party}`;

  // Email di conferma con il link per spostare o annullare: parte dopo la risposta
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
        token: booking.manage_token,
      }),
    );
  }

  return { ok: true, booking };
}

export async function joinWaitlist(slug: string, formData: FormData): Promise<SimpleResult> {
  if (str(formData, "website")) return { ok: false, error: "Richiesta non valida." };
  if (!(await humanCheck(formData))) return { ok: false, error: BOT_ERROR };
  const supabase = await createClient();
  const { error } = await supabase.rpc("public_join_waitlist", {
    p_slug: slug,
    p_service_id: str(formData, "service_id"),
    p_staff_id: str(formData, "staff_id") || null,
    p_date: str(formData, "date"),
    p_name: str(formData, "name"),
    p_phone: str(formData, "phone"),
    p_email: str(formData, "email"),
    p_privacy: formData.get("privacy") !== null,
  });
  if (error) return { ok: false, error: PUBLIC_ERRORS[error.code] ?? "Non è stato possibile iscriverti. Riprova tra poco." };
  return { ok: true };
}

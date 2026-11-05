"use server";

import { refresh } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { SITE_URL, inviteEmail, sendEmail } from "@/lib/email";
import type { ActionState } from "./actions";

// Orari personali, assenze e inviti dei collaboratori (solo il titolare;
// lo stesso vincolo è applicato anche dal database con la RLS).

const str = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const DAYS = ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"];

export async function saveStaffHours(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireOwner();
  const staffId = str(formData, "staff_id");
  const custom = formData.get("custom") !== null;
  const hours: { weekday: number; opens_at: string; closes_at: string }[] = [];

  if (custom) {
    for (let day = 1; day <= 7; day++) {
      if (formData.get(`d${day}_open`) === null) continue;
      for (const n of [1, 2]) {
        const s = str(formData, `d${day}_s${n}`);
        const e = str(formData, `d${day}_e${n}`);
        if (n === 2 && !s && !e) continue; // seconda fascia facoltativa
        if (!TIME_RE.test(s) || !TIME_RE.test(e) || e <= s) return { error: `Controlla gli orari di ${DAYS[day - 1]}.` };
        hours.push({ weekday: day, opens_at: s, closes_at: e });
      }
      const dayRanges = hours.filter((h) => h.weekday === day);
      if (dayRanges.length === 2 && dayRanges[1].opens_at < dayRanges[0].closes_at) {
        return { error: `Di ${DAYS[day - 1]} la seconda fascia deve iniziare dopo la fine della prima.` };
      }
    }
    if (hours.length === 0) return { error: "Indica almeno un giorno di lavoro, oppure usa gli orari dell'attività." };
  }

  const { error } = await supabase.rpc("set_staff_hours", { p_staff_id: staffId, p_hours: hours });
  if (error) return { error: "Non è stato possibile salvare gli orari." };
  refresh();
  return { ok: custom ? "Orari personali salvati." : "Ora segue gli orari dell'attività." };
}

export async function addTimeOff(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireOwner();
  const from = str(formData, "from");
  const to = str(formData, "to");
  const reason = str(formData, "reason");
  if (!DATETIME_RE.test(from) || !DATETIME_RE.test(to)) return { error: "Indica inizio e fine dell'assenza." };
  if (to <= from) return { error: "La fine deve essere dopo l'inizio." };
  if (reason.length > 80) return { error: "Il motivo può avere al massimo 80 caratteri." };

  const { error } = await supabase.rpc("add_time_off", {
    p_staff_id: str(formData, "staff_id"),
    p_from: from.replace("T", " "),
    p_to: to.replace("T", " "),
    p_reason: reason || null,
  });
  if (error) return { error: "Non è stato possibile salvare l'assenza." };
  refresh();
  return { ok: "Assenza aggiunta: in quel periodo non riceverà prenotazioni online." };
}

export async function deleteTimeOff(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, salon } = await requireOwner();
  const { error } = await supabase.from("staff_time_off").delete().eq("id", str(formData, "id")).eq("salon_id", salon.id);
  if (error) return { error: "Non è stato possibile eliminare l'assenza." };
  refresh();
  return { ok: "Assenza eliminata." };
}

export async function inviteStaff(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, salon } = await requireOwner();
  const email = str(formData, "email").toLowerCase();
  const staffId = str(formData, "staff_id") || null;
  if (!EMAIL_RE.test(email) || email.length > 254) return { error: "Scrivi un indirizzo email valido." };

  const { data, error } = await supabase
    .from("salon_invites")
    .insert({ salon_id: salon.id, staff_id: staffId, email })
    .select("token")
    .single();
  if (error || !data) return { error: "Non è stato possibile creare l'invito." };

  const url = `${SITE_URL}/invito/${data.token}`;
  const { data: member } = staffId ? await supabase.from("staff").select("name").eq("id", staffId).maybeSingle() : { data: null };
  const m = inviteEmail({ salonName: salon.name, staffName: member?.name ?? null, url });
  const sent = await sendEmail(email, m.subject, m.html, m.text);

  refresh();
  return {
    ok: sent
      ? `Invito inviato a ${email}.`
      : `Invito creato. L'email non è partita: manda tu questo link a ${email}: ${url}`,
  };
}

export async function revokeInvite(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, salon } = await requireOwner();
  const { error } = await supabase.from("salon_invites").delete().eq("id", str(formData, "id")).eq("salon_id", salon.id);
  if (error) return { error: "Non è stato possibile annullare l'invito." };
  refresh();
  return { ok: "Invito annullato." };
}

export async function removeStaffAccess(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, salon } = await requireOwner();
  const staffId = str(formData, "staff_id");
  const { data: member } = await supabase.from("staff").select("user_id").eq("id", staffId).eq("salon_id", salon.id).maybeSingle();
  if (!member?.user_id) return { error: "Questo collaboratore non ha un account collegato." };

  const del = await supabase.from("salon_members").delete().eq("salon_id", salon.id).eq("user_id", member.user_id).eq("role", "staff");
  if (del.error) return { error: "Non è stato possibile togliere l'accesso." };
  await supabase.from("staff").update({ user_id: null }).eq("id", staffId).eq("salon_id", salon.id);
  refresh();
  return { ok: "Accesso tolto: non potrà più entrare nell'agenda." };
}

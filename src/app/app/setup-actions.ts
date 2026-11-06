"use server";

import { refresh } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { businessType } from "@/lib/business-types";
import { AI_LIMIT_MESSAGE, groqEnabled, groqJson, takeAiRequest } from "@/lib/groq";

// Assistente di configurazione per tutte le attività: dalla descrizione a parole
// propone servizi, collaboratori (o tavoli), orari e consigli.
// Si applica solo dopo il controllo del titolare.

export type Proposal = {
  services: { name: string; duration_min: number; price_eur: number }[];
  staff: { name: string; role_title: string }[];
  tables: { count: number; seats: number }[];
  hours: { weekday: number; opens_at: string; closes_at: string }[];
  tips: string[];
};

export type ProposalResult = { ok: true; proposal: Proposal; ai: boolean } | { ok: false; error: string };

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const int = (v: unknown) => Math.round(Number(v));

/** Tiene solo voci valide: la risposta dell'AI (o del browser) non è mai affidabile */
function clean(raw: Record<string, unknown>, tables: boolean): Proposal {
  const arr = (k: string) => (Array.isArray(raw[k]) ? (raw[k] as Record<string, unknown>[]).filter((x) => x && typeof x === "object") : []);
  return {
    services: arr("services")
      .map((s) => ({
        name: str(s.name, 80),
        duration_min: Math.round(int(s.duration_min) / 5) * 5,
        price_eur: Math.max(0, Math.round(Number(s.price_eur) * 100) / 100 || 0),
      }))
      .filter((s) => s.name.length >= 2 && s.duration_min >= 5 && s.duration_min <= 480 && s.price_eur <= 100000)
      .slice(0, 20),
    staff: tables
      ? []
      : arr("staff").map((s) => ({ name: str(s.name, 60), role_title: str(s.role_title, 60) })).filter((s) => s.name.length >= 2).slice(0, 15),
    tables: tables
      ? arr("tables").map((t) => ({ count: int(t.count), seats: int(t.seats) })).filter((t) => t.count >= 1 && t.count <= 60 && t.seats >= 1 && t.seats <= 40).slice(0, 6)
      : [],
    hours: arr("hours")
      .map((h) => ({ weekday: int(h.weekday), opens_at: str(h.opens_at, 5), closes_at: str(h.closes_at, 5) }))
      .filter((h) => h.weekday >= 1 && h.weekday <= 7 && TIME_RE.test(h.opens_at) && TIME_RE.test(h.closes_at) && h.closes_at > h.opens_at)
      .slice(0, 21),
    tips: (Array.isArray(raw.tips) ? (raw.tips as unknown[]) : []).map((t) => str(t, 200)).filter(Boolean).slice(0, 5),
  };
}

export async function proposeSetup(description: string): Promise<ProposalResult> {
  const { supabase, salon } = await requireOwner();
  const type = businessType(salon.business_type);
  const tables = type.tables === true;

  // Senza chiave AI: servizi tipici del settore e orari standard
  if (!groqEnabled()) {
    return {
      ok: true,
      ai: false,
      proposal: {
        services: type.services.map((s) => ({ name: s.name, duration_min: s.durationMin, price_eur: s.priceEur })),
        staff: [],
        tables: tables ? [{ count: 4, seats: 2 }, { count: 6, seats: 4 }, { count: 2, seats: 6 }] : [],
        hours: [2, 3, 4, 5, 6].flatMap((d) => [
          { weekday: d, opens_at: tables ? "12:00" : "09:00", closes_at: tables ? "15:00" : "13:00" },
          { weekday: d, opens_at: tables ? "19:00" : "15:00", closes_at: tables ? "23:00" : "19:00" },
        ]),
        tips: ["Proposta standard del settore: modificala dopo averla applicata."],
      },
    };
  }

  description = description.trim().slice(0, 1500);
  if (description.length < 10) return { ok: false, error: "Descrivi la tua attività in qualche riga." };
  if (!(await takeAiRequest(supabase, salon.id))) return { ok: false, error: AI_LIMIT_MESSAGE };

  const system = [
    `Aiuti a configurare un gestionale di prenotazioni per un'attività italiana di tipo "${type.label}" chiamata "${salon.name}".`,
    tables
      ? "Si prenotano tavoli: i 'services' sono i turni (es. Pranzo 90 minuti, Cena 120 minuti, prezzo 0); proponi i tavoli come gruppi {count, seats}; 'staff' vuoto."
      : `I 'services' sono le prestazioni prenotabili, con durata realistica in minuti (multipli di 15) e prezzo tipico in euro in Italia; gli 'staff' sono le persone che ricevono appuntamenti (${type.staff.many}); 'tables' vuoto.`,
    "Orari: una riga per fascia, weekday 1=lunedì ... 7=domenica, formato HH:MM; la pausa si fa con due fasce nello stesso giorno; non inserire i giorni di chiusura.",
    "Usa le informazioni del titolare; se manca qualcosa usa valori tipici del settore. In 'tips' 2-4 consigli brevi e concreti in italiano per lavorare meglio con le prenotazioni online.",
    'Rispondi SOLO con JSON: {"services":[{"name":"","duration_min":0,"price_eur":0}],"staff":[{"name":"","role_title":""}],"tables":[{"count":0,"seats":0}],"hours":[{"weekday":1,"opens_at":"09:00","closes_at":"13:00"}],"tips":[""]}',
  ].join("\n");

  try {
    const raw = (await groqJson(system, `Descrizione del titolare: ${description}`)) as Record<string, unknown>;
    const proposal = clean(raw, tables);
    if (proposal.services.length === 0 && proposal.hours.length === 0) return { ok: false, error: "Non ho capito abbastanza. Aggiungi qualche dettaglio e riprova." };
    return { ok: true, ai: true, proposal };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error && e.message === "LIMITE" ? "Limite gratuito raggiunto: riprova tra qualche minuto." : "L'assistente non ha risposto. Riprova.",
    };
  }
}

/** Applica le parti scelte della proposta, ricontrollata qui sul server. */
export async function applySetup(
  input: Proposal,
  parts: { services: boolean; staff: boolean; hours: boolean },
): Promise<{ ok: boolean; message: string }> {
  const { supabase, salon } = await requireOwner();
  const tables = businessType(salon.business_type).tables === true;
  const p = clean(input as unknown as Record<string, unknown>, tables);
  const done: string[] = [];

  if (parts.services && p.services.length) {
    const { data: existing } = await supabase.from("services").select("name").eq("salon_id", salon.id);
    const names = new Set((existing ?? []).map((s) => s.name.toLowerCase()));
    const rows = p.services
      .filter((s) => !names.has(s.name.toLowerCase()))
      .map((s) => ({ salon_id: salon.id, name: s.name, duration_min: s.duration_min, price_cents: Math.round(s.price_eur * 100) }));
    if (rows.length) {
      const { data: added, error } = await supabase.from("services").insert(rows).select("id");
      if (error || !added) return { ok: false, message: "Non è stato possibile salvare i servizi." };
      // I nuovi servizi sono prenotabili con chi c'è già (persone o tavoli)
      const { data: staff } = await supabase.from("staff").select("id").eq("salon_id", salon.id);
      const links = added.flatMap((sv) => (staff ?? []).map((st) => ({ salon_id: salon.id, staff_id: st.id, service_id: sv.id })));
      if (links.length) await supabase.from("staff_services").insert(links);
    }
    done.push(`${rows.length} ${tables ? "turni" : "servizi"}`);
  }

  if (parts.staff) {
    let rows: { salon_id: string; name: string; role_title?: string | null; seats?: number }[];
    if (tables) {
      const { count } = await supabase.from("staff").select("id", { count: "exact", head: true }).eq("salon_id", salon.id).not("seats", "is", null);
      let n = (count ?? 0) + 1;
      rows = p.tables.flatMap((t) => Array.from({ length: t.count }, () => ({ salon_id: salon.id, name: `Tavolo ${n++}`, seats: t.seats })));
    } else {
      const { data: existing } = await supabase.from("staff").select("name").eq("salon_id", salon.id);
      const names = new Set((existing ?? []).map((s) => s.name.toLowerCase()));
      rows = p.staff.filter((s) => !names.has(s.name.toLowerCase())).map((s) => ({ salon_id: salon.id, name: s.name, role_title: s.role_title || null }));
    }
    if (rows.length) {
      const { data: added, error } = await supabase.from("staff").insert(rows).select("id");
      if (error || !added) return { ok: false, message: "Non è stato possibile salvare." };
      // Ognuno fa tutti i servizi: si affina poi in Collaboratori
      const { data: services } = await supabase.from("services").select("id").eq("salon_id", salon.id);
      const links = added.flatMap((a) => (services ?? []).map((s) => ({ salon_id: salon.id, staff_id: a.id, service_id: s.id })));
      if (links.length) await supabase.from("staff_services").insert(links);
    }
    done.push(`${rows.length} ${tables ? "tavoli" : "collaboratori"}`);
  }

  if (parts.hours && p.hours.length) {
    const { error } = await supabase.rpc("set_opening_hours", { p_salon_id: salon.id, p_hours: p.hours });
    if (error) return { ok: false, message: "Orari non validi. Correggili in Orari di apertura." };
    done.push("orari di apertura");
  }

  refresh();
  return { ok: true, message: done.length ? `Fatto: ${done.join(", ")}.` : "Niente da applicare." };
}

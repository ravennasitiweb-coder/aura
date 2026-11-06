"use server";

import { refresh } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { businessType } from "@/lib/business-types";

// Sala e tavoli dei ristoranti. Un tavolo è una riga di "staff" con i posti (seats).

export type SalaResult = { ok: true; message?: string } | { ok: false; error: string };

const GENERIC_ERROR = "Non è stato possibile salvare. Riprova tra poco.";

async function requireRestaurant() {
  const ctx = await requireOwner();
  if (!businessType(ctx.salon.business_type).tables) throw new Error("Disponibile solo per ristoranti.");
  return ctx;
}

/** Aggiunge `count` tavoli da `seats` posti, collegati a tutti i turni (servizi). */
export async function addTables(count: number, seats: number): Promise<SalaResult> {
  const { supabase, salon } = await requireRestaurant();
  if (!Number.isInteger(count) || count < 1 || count > 60) return { ok: false, error: "Da 1 a 60 tavoli alla volta." };
  if (!Number.isInteger(seats) || seats < 1 || seats > 40) return { ok: false, error: "I posti vanno da 1 a 40." };

  const { count: existing } = await supabase.from("staff").select("id", { count: "exact", head: true }).eq("salon_id", salon.id).not("seats", "is", null);
  const start = (existing ?? 0) + 1;
  const { data: tables, error } = await supabase
    .from("staff")
    .insert(Array.from({ length: count }, (_, i) => ({ salon_id: salon.id, name: `Tavolo ${start + i}`, seats })))
    .select("id");
  if (error || !tables) return { ok: false, error: GENERIC_ERROR };

  const linked = await linkAllServices(supabase, salon.id, tables.map((t) => t.id));
  if (!linked) return { ok: false, error: GENERIC_ERROR };
  refresh();
  return { ok: true, message: `${count} tavoli da ${seats} aggiunti.` };
}

type Db = Awaited<ReturnType<typeof requireOwner>>["supabase"];

async function linkAllServices(supabase: Db, salonId: string, tableIds: string[]) {
  const { data: services } = await supabase.from("services").select("id").eq("salon_id", salonId);
  const rows = tableIds.flatMap((staff_id) => (services ?? []).map((s) => ({ salon_id: salonId, staff_id, service_id: s.id })));
  if (rows.length === 0) return true;
  const { error } = await supabase.from("staff_services").upsert(rows, { ignoreDuplicates: true });
  return !error;
}

export async function updateTable(id: string, name: string, seats: number, active: boolean): Promise<SalaResult> {
  const { supabase, salon } = await requireRestaurant();
  name = name.trim();
  if (name.length < 2 || name.length > 60) return { ok: false, error: "Il nome deve avere tra 2 e 60 caratteri." };
  if (!Number.isInteger(seats) || seats < 1 || seats > 40) return { ok: false, error: "I posti vanno da 1 a 40." };
  const { error } = await supabase.from("staff").update({ name, seats, active }).eq("id", id).eq("salon_id", salon.id).not("seats", "is", null);
  if (error) return { ok: false, error: GENERIC_ERROR };
  refresh();
  return { ok: true };
}

export async function deleteTable(id: string): Promise<SalaResult> {
  const { supabase, salon } = await requireRestaurant();
  const { error } = await supabase.from("staff").delete().eq("id", id).eq("salon_id", salon.id).not("seats", "is", null);
  if (error?.code === "23503") return { ok: false, error: "Ha già delle prenotazioni: disattivalo invece di eliminarlo." };
  if (error) return { ok: false, error: GENERIC_ERROR };
  refresh();
  return { ok: true };
}

type Position = { id: string; x: number; y: number; shape: "round" | "square" };

/** Misure della sala, foto (facoltativa) e posizione dei tavoli. */
export async function saveFloorPlan(input: { widthCm: number; depthCm: number; photo?: string | null; positions: Position[] }): Promise<SalaResult> {
  const { supabase, salon } = await requireRestaurant();
  const { widthCm, depthCm, photo, positions } = input;
  const okSize = (n: number) => Number.isInteger(n) && n >= 200 && n <= 10000;
  if (!okSize(widthCm) || !okSize(depthCm)) return { ok: false, error: "Le misure vanno da 2 a 100 metri." };
  if (photo && (!photo.startsWith("data:image/jpeg;base64,") || photo.length > 700_000)) return { ok: false, error: "Foto non valida o troppo grande." };

  const plan: Record<string, unknown> = { salon_id: salon.id, width_cm: widthCm, depth_cm: depthCm, updated_at: new Date().toISOString() };
  if (photo !== undefined) plan.photo = photo;
  const { error } = await supabase.from("floor_plans").upsert(plan);
  if (error) return { ok: false, error: GENERIC_ERROR };

  for (const p of positions.slice(0, 200)) {
    const x = Math.round(Math.min(Math.max(p.x, 0), widthCm));
    const y = Math.round(Math.min(Math.max(p.y, 0), depthCm));
    const shape = p.shape === "square" ? "square" : "round";
    const res = await supabase.from("staff").update({ plan: { x, y, shape } }).eq("id", p.id).eq("salon_id", salon.id).not("seats", "is", null);
    if (res.error) return { ok: false, error: GENERIC_ERROR };
  }
  refresh();
  return { ok: true, message: "Pianta salvata." };
}

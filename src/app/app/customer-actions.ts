"use server";

import { refresh } from "next/cache";
import { getCurrentSalon } from "@/lib/auth";
import type { ActionState } from "./actions";

// Scheda tecnica del cliente (formula colore, allergie, preferenze).
// Tutti i membri dell'attività possono leggerla e modificarla.
export async function saveCustomerNote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, salon } = await getCurrentSalon();
  const key = String(formData.get("customer_key") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();
  if (!key) return { error: "Cliente non valido." };
  if (notes.length > 2000) return { error: "Le note possono avere al massimo 2000 caratteri." };

  const { error } = notes
    ? await supabase
        .from("customer_notes")
        .upsert({ salon_id: salon.id, customer_key: key, notes, updated_at: new Date().toISOString() }, { onConflict: "salon_id,customer_key" })
    : await supabase.from("customer_notes").delete().eq("salon_id", salon.id).eq("customer_key", key);
  if (error) return { error: "Non è stato possibile salvare le note." };
  refresh();
  return { ok: "Note salvate." };
}

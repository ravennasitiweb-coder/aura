import type { Metadata } from "next";
import { Suspense } from "react";
import { getCurrentSalon } from "@/lib/auth";
import { businessType } from "@/lib/business-types";
import { groqEnabled } from "@/lib/groq";
import { SetupAssistant } from "./SetupAssistant";

export const metadata: Metadata = { title: "Assistente — SmartBooking" };

export default function AssistantPage() {
  return (
    <Suspense fallback={<p className="text-ink-soft">Caricamento…</p>}>
      <Assistant />
    </Suspense>
  );
}

async function Assistant() {
  const { supabase, salon, role } = await getCurrentSalon();
  const type = businessType(salon.business_type);
  const tables = type.tables === true;
  const [services, staff, hours] = await Promise.all([
    supabase.from("services").select("id", { count: "exact", head: true }).eq("salon_id", salon.id),
    supabase.from("staff").select("id", { count: "exact", head: true }).eq("salon_id", salon.id),
    supabase.from("opening_hours").select("id", { count: "exact", head: true }).eq("salon_id", salon.id),
  ]);

  // Cosa manca, nell'ordine in cui conviene farlo
  const missing = [
    (services.count ?? 0) === 0 && (tables ? "i turni (pranzo, cena)" : "i servizi"),
    (staff.count ?? 0) === 0 && (tables ? "i tavoli" : `i ${type.staff.many}`),
    (hours.count ?? 0) === 0 && "gli orari di apertura",
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Assistente</h1>
        <p className="mt-1 text-ink-soft">
          {missing.length
            ? `Ti mancano ancora ${missing.join(", ")}. Descrivi la tua attività e preparo tutto io: tu controlli e applichi.`
            : "La configurazione è completa. Puoi comunque chiedere una nuova proposta, per esempio per aggiungere servizi o cambiare orari."}
        </p>
      </div>
      {role === "owner" ? (
        <SetupAssistant aiEnabled={groqEnabled()} tables={tables} staffLabel={type.staff.many} placeholder={placeholderFor(type.label, tables)} />
      ) : (
        <p className="text-ink-soft">Solo il titolare può modificare la configurazione.</p>
      )}
    </div>
  );
}

function placeholderFor(label: string, tables: boolean) {
  return tables
    ? `Es. ${label} con 50 coperti, soprattutto tavoli da 4 e qualcuno da 2 e da 8. Aperti da martedì a domenica, pranzo 12-14:30 e cena 19-23, la domenica solo pranzo.`
    : `Es. ${label} con 2 dipendenti, Giulia e Marco. Aperti dal martedì al sabato 9-19 con pausa 13-14:30. Facciamo… (elenca cosa offri, con prezzi se li sai).`;
}

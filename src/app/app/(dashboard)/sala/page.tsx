import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentSalon } from "@/lib/auth";
import { businessType } from "@/lib/business-types";
import { groqEnabled } from "@/lib/groq";
import { SalaEditor, type Table } from "./SalaEditor";

export const metadata: Metadata = { title: "Sala e tavoli — SmartBooking" };

export default function SalaPage() {
  return (
    <Suspense fallback={<p className="text-ink-soft">Caricamento…</p>}>
      <Sala />
    </Suspense>
  );
}

async function Sala() {
  const { supabase, salon, role } = await getCurrentSalon();
  if (!businessType(salon.business_type).tables) redirect("/app");

  const [tablesRes, planRes] = await Promise.all([
    supabase.from("staff").select("id, name, seats, active, plan").eq("salon_id", salon.id).not("seats", "is", null).order("created_at"),
    supabase.from("floor_plans").select("width_cm, depth_cm, photo").eq("salon_id", salon.id).maybeSingle(),
  ]);
  if (tablesRes.error) throw new Error("Impossibile leggere i tavoli");
  const tables = (tablesRes.data ?? []) as Table[];
  const seats = tables.filter((t) => t.active).reduce((n, t) => n + t.seats, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Sala e tavoli</h1>
        <p className="mt-1 text-ink-soft">
          {tables.length} tavoli, {seats} coperti prenotabili. I clienti indicano quante persone sono: il sistema assegna il tavolo più
          piccolo libero con abbastanza posti.
        </p>
      </div>
      <SalaEditor
        tables={tables}
        canEdit={role === "owner"}
        aiEnabled={groqEnabled()}
        plan={{ widthCm: planRes.data?.width_cm ?? 1000, depthCm: planRes.data?.depth_cm ?? 800, photo: planRes.data?.photo ?? null }}
      />
    </div>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { getCurrentSalon } from "@/lib/auth";
import { groqEnabled } from "@/lib/groq";
import { QuickAdd } from "./QuickAdd";

export const metadata: Metadata = { title: "Aggiungi veloce — SmartBooking" };

export default function QuickAddPage() {
  return (
    <Suspense fallback={<p className="text-ink-soft">Caricamento…</p>}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const { supabase, salon } = await getCurrentSalon();
  const [services, staff] = await Promise.all([
    supabase.from("services").select("id, name").eq("salon_id", salon.id).eq("active", true).order("name"),
    supabase.from("staff").select("id, name").eq("salon_id", salon.id).eq("active", true).order("name"),
  ]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Aggiungi veloce</h1>
        <p className="mt-1 text-ink-soft">Foto dell&apos;agenda, messaggio WhatsApp o vocale: l&apos;AI prepara gli appuntamenti, tu controlli e salvi.</p>
      </div>
      {groqEnabled() ? (
        <QuickAdd services={services.data ?? []} staff={staff.data ?? []} />
      ) : (
        <p className="text-ink-soft">L&apos;AI non è attiva su questo sito.</p>
      )}
    </div>
  );
}

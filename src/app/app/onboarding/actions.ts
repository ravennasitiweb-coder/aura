"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { DEFAULT_BUSINESS_TYPE, businessType, isBusinessType } from "@/lib/business-types";
import { slugify } from "@/lib/slug";

export type OnboardingState = {
  error?: string;
  values?: { name: string; city: string; slug: string; businessType: string; withServices: boolean };
};

export async function createSalon(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const name = String(formData.get("name") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const slug = slugify(String(formData.get("slug") ?? "") || name);
  const rawType = String(formData.get("business_type") ?? DEFAULT_BUSINESS_TYPE);
  const withServices = formData.get("with_services") !== null;
  const values = { name, city, slug, businessType: rawType, withServices };

  if (!isBusinessType(rawType)) return { error: "Scegli il tipo di attività.", values };
  if (name.length < 2 || name.length > 80) return { error: "Il nome deve avere tra 2 e 80 caratteri.", values };
  if (slug.length < 3) return { error: "L'indirizzo deve avere almeno 3 caratteri (lettere, numeri e trattini).", values };

  // Ricontrolla l'utente qui: un'azione del server non si fida mai del browser
  const { supabase } = await requireUser();
  const { data: salon, error } = await supabase.rpc("create_salon", {
    p_name: name,
    p_slug: slug,
    p_city: city || null,
    p_business_type: rawType,
  });

  if (error) {
    if (error.code === "23505") return { error: `L'indirizzo /p/${slug} è già usato da un'altra attività. Scegline un altro.`, values };
    return { error: "Non è stato possibile creare l'attività. Riprova tra poco.", values };
  }

  // Servizi di esempio del settore, se richiesti: si modificano poi in Servizi.
  // Se l'inserimento non riesce l'attività esiste comunque: si aggiungono a mano.
  const salonId = (salon as { id: string }).id;
  if (withServices) {
    await supabase.from("services").insert(
      businessType(rawType).services.map((s) => ({
        salon_id: salonId,
        name: s.name,
        duration_min: s.durationMin,
        price_cents: s.priceEur * 100,
      })),
    );
  }

  // Ristoranti: 6 tavoli da 4 per partire, collegati a tutti i turni (si cambiano in Sala e tavoli)
  if (businessType(rawType).tables) {
    const { data: tables } = await supabase
      .from("staff")
      .insert(Array.from({ length: 6 }, (_, i) => ({ salon_id: salonId, name: `Tavolo ${i + 1}`, seats: 4 })))
      .select("id");
    const { data: services } = await supabase.from("services").select("id").eq("salon_id", salonId);
    const links = (tables ?? []).flatMap((t) => (services ?? []).map((sv) => ({ salon_id: salonId, staff_id: t.id, service_id: sv.id })));
    if (links.length > 0) await supabase.from("staff_services").insert(links);
    redirect("/app/sala");
  }

  redirect("/app");
}

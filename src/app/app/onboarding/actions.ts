"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { slugify } from "@/lib/slug";

export type OnboardingState = { error?: string; values?: { name: string; city: string; slug: string } };

export async function createSalon(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const name = String(formData.get("name") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const slug = slugify(String(formData.get("slug") ?? "") || name);
  const values = { name, city, slug };

  if (name.length < 2 || name.length > 80) return { error: "Il nome deve avere tra 2 e 80 caratteri.", values };
  if (slug.length < 3) return { error: "L'indirizzo deve avere almeno 3 caratteri (lettere, numeri e trattini).", values };

  // Ricontrolla l'utente qui: un'azione del server non si fida mai del browser
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("create_salon", { p_name: name, p_slug: slug, p_city: city || null });

  if (error) {
    if (error.code === "23505") return { error: `L'indirizzo /p/${slug} è già usato da un altro salone. Scegline un altro.`, values };
    return { error: "Non è stato possibile creare il salone. Riprova tra poco.", values };
  }

  redirect("/app");
}

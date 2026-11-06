"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SALON_COOKIE, getCurrentSalon } from "@/lib/auth";

export async function switchSalon(formData: FormData) {
  const id = String(formData.get("salon_id") ?? "");
  const { salons } = await getCurrentSalon();
  // Solo un'attività di cui l'utente è membro
  if (salons.some((s) => s.id === id)) {
    (await cookies()).set(SALON_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  redirect("/app");
}

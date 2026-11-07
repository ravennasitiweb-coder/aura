"use server";

import { getCurrentSalon } from "@/lib/auth";
import { sendEmail } from "@/lib/email";

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Segnalazioni e idee dei clienti in prova: arrivano per email al team */
export async function sendFeedback(message: string, page: string): Promise<{ ok: boolean; text: string }> {
  const { salon, user } = await getCurrentSalon();
  message = String(message ?? "").trim().slice(0, 2000);
  page = String(page ?? "").slice(0, 200);
  if (message.length < 3) return { ok: false, text: "Scrivi qualche parola." };

  const to = process.env.FEEDBACK_EMAIL || "ravennasitiweb@gmail.com";
  const body = `Da: ${salon.name} (${user.email ?? "senza email"})\nPagina: ${page}\n\n${message}`;
  const ok = await sendEmail(to, `SmartBooking · segnalazione da ${salon.name}`, `<pre style="font:14px sans-serif;white-space:pre-wrap">${escapeHtml(body)}</pre>`, body);
  return ok ? { ok: true, text: "Grazie! Ti rispondiamo presto." } : { ok: false, text: `Invio non riuscito. Scrivici a ${to}.` };
}

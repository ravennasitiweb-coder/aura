import { NextResponse, type NextRequest } from "next/server";
import { runDailyTasks } from "@/lib/daily-tasks";
import { emailEnabled } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";

// Attività giornaliera, avviata da Vercel Cron ogni mattina (vedi vercel.json):
// promemoria di domani, riepilogo di oggi, recensioni, richiamo clienti.
//
// Sicurezza: se è impostata CRON_SECRET, Vercel manda "Authorization: Bearer
// <segreto>" e la richiesta senza segreto viene rifiutata. In ogni caso ogni
// messaggio parte una sola volta, quindi un avvio in più non fa danni.

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret ? request.headers.get("authorization") !== `Bearer ${secret}` : !request.headers.get("user-agent")?.startsWith("vercel-cron/")) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }
  if (!emailEnabled() || !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json({ skipped: "Email o chiave segreta non configurate" });
  }

  const report = await runDailyTasks(createAdminClient());
  console.log("Attività giornaliera completata", report);
  return NextResponse.json(report);
}

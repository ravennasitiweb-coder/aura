import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifica che un webhook arrivi davvero da Stripe: confronta la firma
 * nell'intestazione "Stripe-Signature" con quella calcolata con il segreto
 * del webhook, e rifiuta messaggi più vecchi di 5 minuti (anti-replay).
 */
export function verifyStripeSignature(payload: string, header: string | null, secret: string, nowSec = Math.floor(Date.now() / 1000)) {
  if (!header || !secret) return false;
  const parts = header.split(",").map((p) => p.split("=") as [string, string]);
  const timestamp = Number(parts.find(([k]) => k === "t")?.[1]);
  const signatures = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!timestamp || signatures.length === 0 || Math.abs(nowSec - timestamp) > 300) return false;

  const expected = Buffer.from(createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex"));
  return signatures.some((s) => {
    const given = Buffer.from(s ?? "");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

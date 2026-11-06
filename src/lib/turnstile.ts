import "server-only";

// Cloudflare Turnstile: verifica gratuita "non sono un robot" sulla pagina di prenotazione.
// Attiva solo se su Vercel ci sono NEXT_PUBLIC_TURNSTILE_SITE_KEY e TURNSTILE_SECRET_KEY.

export async function humanCheck(formData: FormData): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) return true;
  const token = String(formData.get("cf-turnstile-response") ?? "");
  if (!token || token.length > 2048) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret, response: token }),
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

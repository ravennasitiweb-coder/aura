import "server-only";

// Invio email con Resend (https://resend.com), tramite la sua API HTTP.
// Si attiva solo se sono impostate RESEND_API_KEY ed EMAIL_FROM:
// senza, le funzioni non fanno nulla e l'app funziona lo stesso.

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function emailEnabled() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

async function sendEmail(to: string, subject: string, html: string, text: string) {
  if (!emailEnabled()) return;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, html, text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.error("Invio email non riuscito", res.status, await res.text());
  } catch (err) {
    // Un problema con l'email non deve mai far fallire la prenotazione
    console.error("Invio email non riuscito", err);
  }
}

const whenFormat = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Rome",
});

export async function sendBookingConfirmation(b: {
  to: string;
  customerName: string;
  salonName: string;
  serviceName: string;
  staffName: string;
  startsAt: string;
}) {
  const when = whenFormat.format(new Date(b.startsAt));
  const subject = `Prenotazione confermata: ${b.salonName}, ${when}`;
  const text = [
    `Ciao ${b.customerName},`,
    "",
    `la tua prenotazione da ${b.salonName} è confermata.`,
    `${b.serviceName} con ${b.staffName}, ${when}.`,
    "",
    `Se non puoi venire, avvisa ${b.salonName} il prima possibile.`,
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#1e2b2f">
      <div style="background:#0e5a4a;color:#fff;padding:20px 24px;border-radius:16px 16px 0 0">
        <p style="margin:0;font-size:13px;color:#cde8dc">Prenotazione confermata</p>
        <h1 style="margin:4px 0 0;font-size:22px">${escapeHtml(b.salonName)}</h1>
      </div>
      <div style="border:1px solid #dce3e0;border-top:0;padding:24px;border-radius:0 0 16px 16px">
        <p>Ciao ${escapeHtml(b.customerName)},</p>
        <p style="font-size:18px;margin:16px 0"><strong>${escapeHtml(when)}</strong></p>
        <p>${escapeHtml(b.serviceName)} con ${escapeHtml(b.staffName)}</p>
        <p style="color:#4a5a5f;font-size:14px;margin-top:24px">Se non puoi venire, avvisa ${escapeHtml(b.salonName)} il prima possibile.</p>
      </div>
    </div>`;
  await sendEmail(b.to, subject, html, text);
}

import "server-only";

// Invio email con Resend (https://resend.com), tramite la sua API HTTP.
// Si attiva solo se sono impostate RESEND_API_KEY ed EMAIL_FROM:
// senza, le funzioni non fanno nulla e l'app funziona lo stesso.
// Un errore d'invio non blocca mai l'operazione che lo ha causato.

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://smartbooking.ravennasiti.it").replace(/\/$/, "");

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function emailEnabled() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

/** Invia un'email. Restituisce true se Resend l'ha accettata. */
export async function sendEmail(to: string, subject: string, html: string, text: string): Promise<boolean> {
  if (!emailEnabled()) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, html, text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.error("Invio email non riuscito", res.status, await res.text());
    return res.ok;
  } catch (err) {
    console.error("Invio email non riuscito", err);
    return false;
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
export const formatWhen = (iso: string) => whenFormat.format(new Date(iso));

// Modello grafico comune -----------------------------------------------------

type Button = { label: string; url: string; secondary?: boolean };

function layout(opts: { kicker: string; title: string; paragraphs: string[]; buttons?: Button[]; footer?: string }) {
  const p = opts.paragraphs.map((x) => `<p style="margin:0 0 12px">${x}</p>`).join("");
  const buttons = (opts.buttons ?? [])
    .map(
      (b) =>
        `<a href="${escapeHtml(b.url)}" style="display:inline-block;margin:4px 6px 4px 0;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:bold;${
          b.secondary ? "border:1px solid #dce3e0;color:#1e2b2f" : "background:#0e5a4a;color:#fff"
        }">${escapeHtml(b.label)}</a>`,
    )
    .join("");
  return `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#1e2b2f">
      <div style="background:#0e5a4a;color:#fff;padding:20px 24px;border-radius:16px 16px 0 0">
        <p style="margin:0;font-size:13px;color:#cde8dc">${escapeHtml(opts.kicker)}</p>
        <h1 style="margin:4px 0 0;font-size:22px">${escapeHtml(opts.title)}</h1>
      </div>
      <div style="border:1px solid #dce3e0;border-top:0;padding:24px;border-radius:0 0 16px 16px">
        ${p}
        ${buttons ? `<div style="margin-top:16px">${buttons}</div>` : ""}
        ${opts.footer ? `<p style="color:#7e8c90;font-size:12px;margin-top:24px">${opts.footer}</p>` : ""}
      </div>
    </div>`;
}

const manageUrl = (token: string) => `${SITE_URL}/gestisci/${token}`;
const unsubscribeFooter = (token: string) =>
  `Non vuoi più ricevere questi messaggi? <a href="${escapeHtml(`${SITE_URL}/disiscrizione/${token}`)}" style="color:#7e8c90">Disiscriviti</a>.`;

// Messaggi ------------------------------------------------------------------

type Appt = { customerName: string; salonName: string; serviceName: string; staffName: string; startsAt: string; token: string };

export function bookingConfirmationEmail(b: Appt) {
  const when = formatWhen(b.startsAt);
  return {
    subject: `Prenotazione confermata: ${b.salonName}, ${when}`,
    html: layout({
      kicker: "Prenotazione confermata",
      title: b.salonName,
      paragraphs: [
        `Ciao ${escapeHtml(b.customerName)},`,
        `<strong style="font-size:18px">${escapeHtml(when)}</strong>`,
        `${escapeHtml(b.serviceName)} con ${escapeHtml(b.staffName)}`,
      ],
      buttons: [{ label: "Sposta o annulla", url: manageUrl(b.token), secondary: true }],
      footer: `Se non puoi venire, avvisa ${escapeHtml(b.salonName)} il prima possibile.`,
    }),
    text: `Ciao ${b.customerName},\nla tua prenotazione da ${b.salonName} è confermata: ${b.serviceName} con ${b.staffName}, ${when}.\nPer spostarla o annullarla: ${manageUrl(b.token)}`,
  };
}

export function reminderEmail(b: Appt) {
  const when = formatWhen(b.startsAt);
  return {
    subject: `Promemoria: ${b.salonName}, ${when}`,
    html: layout({
      kicker: "Promemoria appuntamento",
      title: b.salonName,
      paragraphs: [
        `Ciao ${escapeHtml(b.customerName)}, ti aspettiamo:`,
        `<strong style="font-size:18px">${escapeHtml(when)}</strong>`,
        `${escapeHtml(b.serviceName)} con ${escapeHtml(b.staffName)}`,
      ],
      buttons: [
        { label: "Confermo", url: `${manageUrl(b.token)}?azione=conferma` },
        { label: "Sposta o annulla", url: manageUrl(b.token), secondary: true },
      ],
      footer: "Se non puoi venire, annulla dal link: l'orario tornerà disponibile per altri clienti.",
    }),
    text: `Ciao ${b.customerName}, ti aspettiamo da ${b.salonName}: ${b.serviceName} con ${b.staffName}, ${when}.\nConferma, sposta o annulla: ${manageUrl(b.token)}`,
  };
}

export function waitlistEmail(w: { customerName: string; salonName: string; serviceName: string; day: string; bookUrl: string }) {
  return {
    subject: `Si è liberato un posto da ${w.salonName}`,
    html: layout({
      kicker: "Lista d'attesa",
      title: w.salonName,
      paragraphs: [
        `Ciao ${escapeHtml(w.customerName)},`,
        `si è liberato un orario per <strong>${escapeHtml(w.serviceName)}</strong> nel giorno che avevi chiesto (${escapeHtml(w.day)}).`,
        "Prenota in fretta: il primo che conferma prende il posto.",
      ],
      buttons: [{ label: "Prenota ora", url: w.bookUrl }],
    }),
    text: `Ciao ${w.customerName}, da ${w.salonName} si è liberato un orario per ${w.serviceName} (${w.day}). Prenota: ${w.bookUrl}`,
  };
}

export function inviteEmail(i: { salonName: string; staffName: string | null; url: string }) {
  return {
    subject: `Invito a SmartBooking: ${i.salonName}`,
    html: layout({
      kicker: "Invito",
      title: i.salonName,
      paragraphs: [
        `Ciao${i.staffName ? ` ${escapeHtml(i.staffName)}` : ""},`,
        `${escapeHtml(i.salonName)} ti ha invitato a usare SmartBooking per vedere e gestire la tua agenda.`,
        "Crea il tuo account con questo indirizzo email (o accedi, se ne hai già uno) e accetta l'invito.",
      ],
      buttons: [{ label: "Accetta l'invito", url: i.url }],
    }),
    text: `${i.salonName} ti ha invitato su SmartBooking. Accetta qui: ${i.url}`,
  };
}

export function recallEmail(r: { customerName: string; salonName: string; bookUrl: string; token: string; weeks: number }) {
  return {
    subject: `È ora di tornare da ${r.salonName}?`,
    html: layout({
      kicker: "Ti aspettiamo",
      title: r.salonName,
      paragraphs: [
        `Ciao ${escapeHtml(r.customerName)},`,
        `sono passate circa ${r.weeks} settimane dalla tua ultima visita. Vuoi prenotare il prossimo appuntamento?`,
      ],
      buttons: [{ label: "Prenota", url: r.bookUrl }],
      footer: unsubscribeFooter(r.token),
    }),
    text: `Ciao ${r.customerName}, sono passate circa ${r.weeks} settimane dalla tua ultima visita da ${r.salonName}. Prenota: ${r.bookUrl}`,
  };
}

export function gapsEmail(g: { customerName: string; salonName: string; dayLabel: string; times: string[]; bookUrl: string; token: string }) {
  return {
    subject: `${g.salonName}: posti liberi ${g.dayLabel}`,
    html: layout({
      kicker: "Posti liberi",
      title: g.salonName,
      paragraphs: [
        `Ciao ${escapeHtml(g.customerName)},`,
        `${escapeHtml(g.dayLabel)} abbiamo ancora qualche posto libero${g.times.length ? `, per esempio alle ${g.times.map(escapeHtml).join(", ")}` : ""}.`,
      ],
      buttons: [{ label: "Prenota", url: g.bookUrl }],
      footer: unsubscribeFooter(g.token),
    }),
    text: `Ciao ${g.customerName}, ${g.dayLabel} da ${g.salonName} ci sono posti liberi. Prenota: ${g.bookUrl}`,
  };
}

export function reviewEmail(r: { customerName: string; salonName: string; reviewUrl: string; token: string }) {
  return {
    subject: `Com'è andata da ${r.salonName}?`,
    html: layout({
      kicker: "La tua opinione",
      title: r.salonName,
      paragraphs: [
        `Ciao ${escapeHtml(r.customerName)}, grazie di essere passato!`,
        "Ci aiuteresti con una recensione su Google? Bastano 30 secondi.",
      ],
      buttons: [{ label: "Lascia una recensione", url: r.reviewUrl }],
      footer: unsubscribeFooter(r.token),
    }),
    text: `Ciao ${r.customerName}, grazie di essere passato da ${r.salonName}! Lasciaci una recensione: ${r.reviewUrl}`,
  };
}

export function dailySummaryEmail(d: { salonName: string; dayLabel: string; rows: { time: string; customer: string; service: string; staff: string }[] }) {
  const list = d.rows.length
    ? `<table style="width:100%;border-collapse:collapse;font-size:14px">${d.rows
        .map(
          (r) =>
            `<tr><td style="padding:6px 8px 6px 0;border-bottom:1px solid #eef2f0;font-weight:bold">${escapeHtml(r.time)}</td><td style="padding:6px 0;border-bottom:1px solid #eef2f0">${escapeHtml(r.customer)}<br><span style="color:#4a5a5f">${escapeHtml(r.service)} con ${escapeHtml(r.staff)}</span></td></tr>`,
        )
        .join("")}</table>`
    : "Nessun appuntamento in agenda.";
  return {
    subject: `${d.salonName}: la giornata di ${d.dayLabel} (${d.rows.length} appuntamenti)`,
    html: layout({
      kicker: `Riepilogo di ${d.dayLabel}`,
      title: d.salonName,
      paragraphs: [list],
      buttons: [{ label: "Apri l'agenda", url: `${SITE_URL}/app/agenda` }],
      footer: "Puoi disattivare questo riepilogo in Impostazioni.",
    }),
    text: `${d.salonName}, ${d.dayLabel}:\n${d.rows.map((r) => `${r.time} ${r.customer} (${r.service} con ${r.staff})`).join("\n") || "Nessun appuntamento."}`,
  };
}

/** Compatibilità con il codice esistente: conferma della prenotazione online */
export async function sendBookingConfirmation(b: Appt & { to: string }) {
  const m = bookingConfirmationEmail(b);
  await sendEmail(b.to, m.subject, m.html, m.text);
}

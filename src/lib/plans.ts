// Piani di abbonamento: un unico elenco per landing e pagina Abbonamento.
// Il prezzo vero che viene addebitato è quello impostato su Stripe (variabili STRIPE_PRICE_*).

export type PlanId = "solo" | "salone";

/** Giorni di prova gratuita al primo abbonamento */
export const TRIAL_DAYS = 30;

const BASE = ["Agenda online", "Pagina di prenotazione", "Promemoria ai clienti", "Foto, vocale e WhatsApp con l'AI"];
const ALL = [...BASE, "Lista d'attesa", "Assistente AI", "Tavoli e pianta della sala"];

export const PLANS: {
  id: PlanId;
  name: string;
  price: number;
  text: string;
  items: string[];
  highlight?: boolean;
}[] = [
  { id: "solo", name: "Solo", price: 15, text: "Per chi lavora da solo.", items: ["1 persona", ...BASE] },
  { id: "salone", name: "Team", price: 29, text: "Per chi lavora in squadra.", items: ["Collaboratori o tavoli illimitati", ...ALL, "In arrivo: segretaria WhatsApp"], highlight: true },
];

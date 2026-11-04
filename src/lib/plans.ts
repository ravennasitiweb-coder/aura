// Piani di abbonamento: un unico elenco per landing e pagina Abbonamento.
// Prezzi previsti, da confermare prima della vendita. Il prezzo vero che
// viene addebitato è quello impostato su Stripe (variabili STRIPE_PRICE_*).

export type PlanId = "solo" | "salone" | "studio";

export const PLANS: {
  id: PlanId;
  name: string;
  price: number;
  text: string;
  items: string[];
  highlight?: boolean;
}[] = [
  { id: "solo", name: "Solo", price: 19, text: "Per chi lavora da solo.", items: ["1 collaboratore", "Agenda online", "Pagina di prenotazione"] },
  {
    id: "salone",
    name: "Salone",
    price: 39,
    text: "Il piano più scelto.",
    items: ["Fino a 5 collaboratori", "Agenda online", "Pagina di prenotazione", "In arrivo: assistente AI in chat"],
    highlight: true,
  },
  {
    id: "studio",
    name: "Studio",
    price: 69,
    text: "Per saloni grandi.",
    items: ["Collaboratori illimitati", "Agenda online", "Pagina di prenotazione", "In arrivo: assistente AI in chat"],
  },
];

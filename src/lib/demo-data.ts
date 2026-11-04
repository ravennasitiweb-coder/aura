// Dati finti del salone demo. Nella Fase 1 verranno sostituiti
// dalle tabelle Supabase `staff`, `services` e `appointments`.

export type Staff = {
  id: string;
  name: string;
  role: string;
};

export type Service = {
  id: string;
  name: string;
  durationMin: number;
  priceEur: number;
  keywords: string[];
};

export type Appointment = {
  id: string;
  staffId: string;
  serviceId: string;
  customer: string;
  // Minuti dalla mezzanotte, es. 9:30 = 570
  start: number;
  end: number;
  source: "manuale" | "online" | "chatbot";
};

export const SALON = {
  name: "Salone Aurora",
  city: "Bologna",
  openMin: 9 * 60,
  closeMin: 19 * 60,
};

export const STAFF: Staff[] = [
  { id: "giulia", name: "Giulia", role: "Hair stylist" },
  { id: "marco", name: "Marco", role: "Barbiere" },
  { id: "sara", name: "Sara", role: "Estetista" },
];

export const SERVICES: Service[] = [
  { id: "taglio-donna", name: "Taglio e piega", durationMin: 60, priceEur: 45, keywords: ["piega", "taglio donna", "capelli"] },
  { id: "colore", name: "Colore", durationMin: 90, priceEur: 65, keywords: ["colore", "tinta", "meches", "balayage"] },
  { id: "taglio-uomo", name: "Taglio uomo", durationMin: 30, priceEur: 22, keywords: ["taglio uomo", "taglio", "sfumatura"] },
  { id: "barba", name: "Barba", durationMin: 30, priceEur: 15, keywords: ["barba", "rasatura"] },
  { id: "manicure", name: "Manicure", durationMin: 45, priceEur: 28, keywords: ["manicure", "unghie", "smalto"] },
  { id: "pulizia-viso", name: "Pulizia viso", durationMin: 60, priceEur: 50, keywords: ["viso", "pulizia"] },
];

// Chi esegue quale servizio (in futuro: tabella `staff_services`)
export const STAFF_SERVICES: Record<string, string[]> = {
  giulia: ["taglio-donna", "colore"],
  marco: ["taglio-uomo", "barba"],
  sara: ["manicure", "pulizia-viso"],
};

const t = (h: number, m = 0) => h * 60 + m;

export const INITIAL_APPOINTMENTS: Appointment[] = [
  { id: "a1", staffId: "giulia", serviceId: "colore", customer: "Elena R.", start: t(9), end: t(10, 30), source: "manuale" },
  { id: "a2", staffId: "giulia", serviceId: "taglio-donna", customer: "Chiara B.", start: t(11), end: t(12), source: "online" },
  { id: "a3", staffId: "giulia", serviceId: "taglio-donna", customer: "Paola M.", start: t(15), end: t(16), source: "chatbot" },
  { id: "a4", staffId: "marco", serviceId: "taglio-uomo", customer: "Luca F.", start: t(9, 30), end: t(10), source: "manuale" },
  { id: "a5", staffId: "marco", serviceId: "barba", customer: "Andrea T.", start: t(10), end: t(10, 30), source: "online" },
  { id: "a6", staffId: "marco", serviceId: "taglio-uomo", customer: "Davide C.", start: t(12), end: t(12, 30), source: "chatbot" },
  { id: "a7", staffId: "marco", serviceId: "taglio-uomo", customer: "Matteo G.", start: t(17), end: t(17, 30), source: "manuale" },
  { id: "a8", staffId: "sara", serviceId: "pulizia-viso", customer: "Francesca L.", start: t(10), end: t(11), source: "online" },
  { id: "a9", staffId: "sara", serviceId: "manicure", customer: "Giorgia P.", start: t(14), end: t(14, 45), source: "manuale" },
];

export function formatTime(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${m.toString().padStart(2, "0")}`;
}

export function serviceById(id: string) {
  return SERVICES.find((s) => s.id === id);
}

export function staffById(id: string) {
  return STAFF.find((s) => s.id === id);
}

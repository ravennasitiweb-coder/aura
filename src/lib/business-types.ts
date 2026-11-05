// Tipi di attività supportati da SmartBooking.
// Per aggiungerne uno: una voce qui + lo stesso id nel vincolo
// "business_type" del database (migrazione tipi_di_attivita).
//
// Sono tutte attività "un cliente, un professionista, un servizio a durata
// fissa". Restano escluse quelle sanitarie (dati sulla salute, GDPR più severo).

export type BusinessTypeId =
  | "parrucchiere"
  | "barbiere"
  | "estetista"
  | "onicotecnica"
  | "tatuatore"
  | "massaggi"
  | "personal_trainer"
  | "toelettatura";

export type BusinessType = {
  id: BusinessTypeId;
  /** Come si presenta l'attività, es. "Studio tatuaggi" */
  label: string;
  /** Come si chiama il posto, es. "studio", "barberia" */
  place: string;
  /** Articoli del posto: "il salone" / "del salone", "lo studio" / "dello studio" */
  articles: { the: string; of: string };
  /** Chi riceve gli appuntamenti, al singolare e al plurale */
  staff: { one: string; many: string };
  /** Frase di presentazione per la landing */
  pitch: string;
  /** Esempio di nome per il modulo di registrazione */
  exampleName: string;
  /** Servizi proposti alla registrazione: prezzi di esempio, modificabili */
  services: { name: string; durationMin: number; priceEur: number }[];
};

export const BUSINESS_TYPES: BusinessType[] = [
  {
    id: "parrucchiere",
    label: "Parrucchiere",
    pitch: "Colori, pieghe e trattamenti lunghi con la loro durata reale, senza incastri impossibili.",
    place: "salone",
    articles: { the: "il", of: "del" },
    staff: { one: "collaboratore", many: "collaboratori" },
    exampleName: "Salone Aurora",
    services: [
      { name: "Taglio e piega", durationMin: 60, priceEur: 35 },
      { name: "Piega", durationMin: 30, priceEur: 20 },
      { name: "Colore", durationMin: 90, priceEur: 55 },
      { name: "Taglio bambino", durationMin: 30, priceEur: 15 },
    ],
  },
  {
    id: "barbiere",
    label: "Barbiere",
    pitch: "Taglio e barba con il barbiere giusto, la giornata sempre sotto controllo.",
    place: "barberia",
    articles: { the: "la", of: "della" },
    staff: { one: "barbiere", many: "barbieri" },
    exampleName: "Barberia Da Marco",
    services: [
      { name: "Taglio uomo", durationMin: 30, priceEur: 20 },
      { name: "Barba", durationMin: 30, priceEur: 15 },
      { name: "Taglio e barba", durationMin: 60, priceEur: 32 },
    ],
  },
  {
    id: "estetista",
    label: "Centro estetico",
    pitch: "Trattamenti viso e corpo con durate diverse, assegnati solo a chi li sa fare.",
    place: "centro",
    articles: { the: "il", of: "del" },
    staff: { one: "estetista", many: "estetiste" },
    exampleName: "Centro estetico Venere",
    services: [
      { name: "Pulizia viso", durationMin: 60, priceEur: 50 },
      { name: "Manicure", durationMin: 45, priceEur: 25 },
      { name: "Ceretta gambe", durationMin: 30, priceEur: 25 },
      { name: "Massaggio rilassante", durationMin: 60, priceEur: 50 },
    ],
  },
  {
    id: "onicotecnica",
    label: "Onicotecnica",
    pitch: "Ricostruzioni e refill con i tempi giusti, senza clienti che si accavallano.",
    place: "studio",
    articles: { the: "lo", of: "dello" },
    staff: { one: "onicotecnica", many: "onicotecniche" },
    exampleName: "Nail Studio Luna",
    services: [
      { name: "Ricostruzione unghie", durationMin: 120, priceEur: 50 },
      { name: "Refill", durationMin: 90, priceEur: 35 },
      { name: "Semipermanente mani", durationMin: 60, priceEur: 25 },
      { name: "Pedicure", durationMin: 60, priceEur: 30 },
    ],
  },
  {
    id: "tatuatore",
    label: "Studio tatuaggi",
    pitch: "Consulenze e sedute lunghe in agenda, con il tatuatore che il cliente preferisce.",
    place: "studio",
    articles: { the: "lo", of: "dello" },
    staff: { one: "tatuatore", many: "tatuatori" },
    exampleName: "Inkwell Tattoo",
    services: [
      { name: "Consulenza", durationMin: 30, priceEur: 0 },
      { name: "Tatuaggio piccolo", durationMin: 60, priceEur: 80 },
      { name: "Seduta tatuaggio", durationMin: 180, priceEur: 250 },
      { name: "Piercing", durationMin: 30, priceEur: 40 },
    ],
  },
  {
    id: "massaggi",
    label: "Massaggi e benessere",
    pitch: "Massaggi da 30 o 60 minuti prenotabili anche la sera, quando il centro è chiuso.",
    place: "centro",
    articles: { the: "il", of: "del" },
    staff: { one: "operatore", many: "operatori" },
    exampleName: "Oasi Benessere",
    services: [
      { name: "Massaggio 30 minuti", durationMin: 30, priceEur: 30 },
      { name: "Massaggio 60 minuti", durationMin: 60, priceEur: 55 },
      { name: "Massaggio decontratturante", durationMin: 60, priceEur: 60 },
    ],
  },
  {
    id: "personal_trainer",
    label: "Personal trainer",
    pitch: "Allenamenti individuali e di coppia, con la prova gratuita prenotabile online.",
    place: "studio",
    articles: { the: "lo", of: "dello" },
    staff: { one: "trainer", many: "trainer" },
    exampleName: "Studio Fit Ravenna",
    services: [
      { name: "Prova gratuita", durationMin: 30, priceEur: 0 },
      { name: "Allenamento individuale", durationMin: 60, priceEur: 40 },
      { name: "Allenamento di coppia", durationMin: 60, priceEur: 60 },
    ],
  },
  {
    id: "toelettatura",
    label: "Toelettatura",
    pitch: "Bagni e tagli per ogni taglia, con i tempi di ogni servizio già calcolati.",
    place: "toelettatura",
    articles: { the: "la", of: "della" },
    staff: { one: "toelettatore", many: "toelettatori" },
    exampleName: "Toelettatura Fido",
    services: [
      { name: "Bagno cane piccolo", durationMin: 60, priceEur: 30 },
      { name: "Bagno e taglio", durationMin: 90, priceEur: 45 },
      { name: "Taglio unghie", durationMin: 15, priceEur: 10 },
    ],
  },
];

export const DEFAULT_BUSINESS_TYPE: BusinessTypeId = "parrucchiere";

export function isBusinessType(value: string): value is BusinessTypeId {
  return BUSINESS_TYPES.some((t) => t.id === value);
}

/** "il salone", "dello studio"… */
export function placeWith(t: BusinessType, kind: "the" | "of") {
  return `${t.articles[kind]} ${t.place}`;
}

/** Configurazione del tipo; se il valore è sconosciuto, quella predefinita */
export function businessType(id: string | null | undefined): BusinessType {
  return BUSINESS_TYPES.find((t) => t.id === id) ?? BUSINESS_TYPES[0];
}

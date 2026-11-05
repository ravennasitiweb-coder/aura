// Tipi di attività supportati da SmartBooking.
// Per aggiungerne uno: una voce qui + lo stesso id nel vincolo
// "business_type" del database (ultima migrazione "tipi_di_attivita").
// Il test business-types.test.ts controlla che i due elenchi coincidano.
//
// Sono tutte attività "un cliente, un professionista, un servizio a durata
// fissa". Restano escluse quelle sanitarie (dati sulla salute, GDPR più severo).

export type BusinessCategory = "Bellezza" | "Benessere" | "Sport" | "Lezioni" | "Professionisti" | "Casa e servizi" | "Animali";

export const CATEGORIES: BusinessCategory[] = ["Bellezza", "Benessere", "Sport", "Lezioni", "Professionisti", "Casa e servizi", "Animali"];

export type BusinessType = {
  id: string;
  category: BusinessCategory;
  /** Come si presenta l'attività, es. "Studio tatuaggi" */
  label: string;
  /** Come si chiama il posto, es. "studio", "barberia" */
  place: string;
  /** Articoli del posto: "il salone" / "del salone", "l'agenzia" / "dell'agenzia" */
  articles: { the: "il" | "lo" | "la" | "l'"; of: "del" | "dello" | "della" | "dell'" };
  /** Chi riceve gli appuntamenti, al singolare e al plurale */
  staff: { one: string; many: string };
  /** Esempio di nome per il modulo di registrazione */
  exampleName: string;
  /** Servizi proposti alla registrazione: prezzi di esempio, modificabili */
  services: { name: string; durationMin: number; priceEur: number }[];
  /** Attività in evidenza nella landing, con la sua frase di presentazione */
  featured?: { pitch: string };
};

const s = (name: string, durationMin: number, priceEur: number) => ({ name, durationMin, priceEur });

const IL = { the: "il", of: "del" } as const;
const LO = { the: "lo", of: "dello" } as const;
const LA = { the: "la", of: "della" } as const;
const L_ = { the: "l'", of: "dell'" } as const;

export const BUSINESS_TYPES: BusinessType[] = [
  // --- Bellezza -------------------------------------------------------------
  {
    id: "parrucchiere",
    category: "Bellezza",
    label: "Parrucchiere",
    place: "salone",
    articles: IL,
    staff: { one: "collaboratore", many: "collaboratori" },
    exampleName: "Salone Aurora",
    services: [s("Taglio e piega", 60, 35), s("Piega", 30, 20), s("Colore", 90, 55), s("Taglio bambino", 30, 15)],
    featured: { pitch: "Colori, pieghe e trattamenti lunghi con la loro durata reale, senza incastri impossibili." },
  },
  {
    id: "barbiere",
    category: "Bellezza",
    label: "Barbiere",
    place: "barberia",
    articles: LA,
    staff: { one: "barbiere", many: "barbieri" },
    exampleName: "Barberia Da Marco",
    services: [s("Taglio uomo", 30, 20), s("Barba", 30, 15), s("Taglio e barba", 60, 32)],
    featured: { pitch: "Taglio e barba con il barbiere giusto, la giornata sempre sotto controllo." },
  },
  {
    id: "estetista",
    category: "Bellezza",
    label: "Centro estetico",
    place: "centro",
    articles: IL,
    staff: { one: "estetista", many: "estetiste" },
    exampleName: "Centro estetico Venere",
    services: [s("Pulizia viso", 60, 50), s("Manicure", 45, 25), s("Ceretta gambe", 30, 25), s("Massaggio rilassante", 60, 50)],
    featured: { pitch: "Trattamenti viso e corpo con durate diverse, assegnati solo a chi li sa fare." },
  },
  {
    id: "onicotecnica",
    category: "Bellezza",
    label: "Onicotecnica",
    place: "studio",
    articles: LO,
    staff: { one: "onicotecnica", many: "onicotecniche" },
    exampleName: "Nail Studio Luna",
    services: [s("Ricostruzione unghie", 120, 50), s("Refill", 90, 35), s("Semipermanente mani", 60, 25), s("Pedicure", 60, 30)],
    featured: { pitch: "Ricostruzioni e refill con i tempi giusti, senza clienti che si accavallano." },
  },
  {
    id: "tatuatore",
    category: "Bellezza",
    label: "Studio tatuaggi",
    place: "studio",
    articles: LO,
    staff: { one: "tatuatore", many: "tatuatori" },
    exampleName: "Inkwell Tattoo",
    services: [s("Consulenza", 30, 0), s("Tatuaggio piccolo", 60, 80), s("Seduta tatuaggio", 180, 250), s("Piercing", 30, 40)],
    featured: { pitch: "Consulenze e sedute lunghe in agenda, con il tatuatore che il cliente preferisce." },
  },
  {
    id: "lash_maker",
    category: "Bellezza",
    label: "Lash maker",
    place: "studio",
    articles: LO,
    staff: { one: "lash artist", many: "lash artist" },
    exampleName: "Lash Studio Iris",
    services: [s("Extension ciglia one to one", 120, 70), s("Refill ciglia", 60, 40), s("Laminazione ciglia", 60, 45)],
  },
  {
    id: "brow_specialist",
    category: "Bellezza",
    label: "Brow specialist",
    place: "studio",
    articles: LO,
    staff: { one: "brow specialist", many: "brow specialist" },
    exampleName: "Brow Bar Ravenna",
    services: [s("Design sopracciglia", 30, 20), s("Laminazione sopracciglia", 45, 35), s("Henné sopracciglia", 30, 25)],
  },
  {
    id: "make_up_artist",
    category: "Bellezza",
    label: "Make-up artist",
    place: "studio",
    articles: LO,
    staff: { one: "make-up artist", many: "make-up artist" },
    exampleName: "Studio Make-up Sofia",
    services: [s("Trucco giorno", 45, 40), s("Trucco sera", 60, 50), s("Prova trucco sposa", 90, 80), s("Lezione di auto-trucco", 90, 70)],
  },
  {
    id: "parrucchiere_domicilio",
    category: "Bellezza",
    label: "Parrucchiere a domicilio",
    place: "attività",
    articles: L_,
    staff: { one: "parrucchiere", many: "parrucchieri" },
    exampleName: "Capelli a Casa Tua",
    services: [s("Taglio a domicilio", 60, 35), s("Piega a domicilio", 45, 25), s("Colore a domicilio", 120, 60)],
  },
  {
    id: "solarium",
    category: "Bellezza",
    label: "Centro abbronzatura",
    place: "centro",
    articles: IL,
    staff: { one: "operatore", many: "operatori" },
    exampleName: "Sun Center",
    services: [s("Doccia solare", 15, 10), s("Lettino solare", 15, 8), s("Abbronzatura spray", 30, 30)],
  },
  {
    id: "piercing",
    category: "Bellezza",
    label: "Studio piercing",
    place: "studio",
    articles: LO,
    staff: { one: "piercer", many: "piercer" },
    exampleName: "Pierce Lab",
    services: [s("Piercing lobo", 15, 25), s("Piercing cartilagine", 30, 40), s("Cambio gioiello", 15, 10)],
  },
  {
    id: "trucco_semipermanente",
    category: "Bellezza",
    label: "Trucco semipermanente",
    place: "studio",
    articles: LO,
    staff: { one: "dermopigmentista", many: "dermopigmentisti" },
    exampleName: "PMU Studio Aurora",
    services: [s("Consulenza", 30, 0), s("Microblading sopracciglia", 150, 250), s("Eyeliner semipermanente", 120, 200), s("Ritocco", 90, 80)],
  },

  // --- Benessere ------------------------------------------------------------
  {
    id: "massaggi",
    category: "Benessere",
    label: "Massaggi e benessere",
    place: "centro",
    articles: IL,
    staff: { one: "operatore", many: "operatori" },
    exampleName: "Oasi Benessere",
    services: [s("Massaggio 30 minuti", 30, 30), s("Massaggio 60 minuti", 60, 55), s("Massaggio decontratturante", 60, 60)],
    featured: { pitch: "Massaggi da 30 o 60 minuti prenotabili anche la sera, quando il centro è chiuso." },
  },
  {
    id: "riflessologia",
    category: "Benessere",
    label: "Riflessologia plantare",
    place: "studio",
    articles: LO,
    staff: { one: "riflessologo", many: "riflessologi" },
    exampleName: "Studio Armonia",
    services: [s("Trattamento 30 minuti", 30, 30), s("Trattamento 60 minuti", 60, 50), s("Primo incontro", 60, 40)],
  },
  {
    id: "shiatsu_reiki",
    category: "Benessere",
    label: "Shiatsu e reiki",
    place: "studio",
    articles: LO,
    staff: { one: "operatore", many: "operatori" },
    exampleName: "Centro Ki",
    services: [s("Trattamento shiatsu", 60, 50), s("Trattamento reiki", 60, 45), s("Trattamento breve", 30, 30)],
  },
  {
    id: "consulente_immagine",
    category: "Benessere",
    label: "Consulente d'immagine",
    place: "studio",
    articles: LO,
    staff: { one: "consulente", many: "consulenti" },
    exampleName: "Studio Colore",
    services: [s("Analisi armocromia", 90, 120), s("Consulenza d'immagine", 60, 80), s("Personal shopping", 120, 150)],
  },

  // --- Sport ----------------------------------------------------------------
  {
    id: "personal_trainer",
    category: "Sport",
    label: "Personal trainer",
    place: "studio",
    articles: LO,
    staff: { one: "trainer", many: "trainer" },
    exampleName: "Studio Fit Ravenna",
    services: [s("Prova gratuita", 30, 0), s("Allenamento individuale", 60, 40), s("Allenamento di coppia", 60, 60)],
    featured: { pitch: "Allenamenti individuali e di coppia, con la prova gratuita prenotabile online." },
  },
  {
    id: "pilates",
    category: "Sport",
    label: "Pilates (lezioni individuali)",
    place: "studio",
    articles: LO,
    staff: { one: "istruttore", many: "istruttori" },
    exampleName: "Studio Pilates Core",
    services: [s("Lezione di prova", 30, 0), s("Lezione individuale", 60, 45), s("Lezione di coppia", 60, 60)],
  },
  {
    id: "yoga",
    category: "Sport",
    label: "Yoga (lezioni individuali)",
    place: "studio",
    articles: LO,
    staff: { one: "insegnante", many: "insegnanti" },
    exampleName: "Yoga Studio Prana",
    services: [s("Lezione di prova", 60, 0), s("Lezione individuale", 60, 40), s("Lezione di coppia", 60, 55)],
  },
  {
    id: "tennis_padel",
    category: "Sport",
    label: "Maestro di tennis e padel",
    place: "scuola",
    articles: LA,
    staff: { one: "maestro", many: "maestri" },
    exampleName: "Scuola Tennis Ravenna",
    services: [s("Lezione privata 30 minuti", 30, 25), s("Lezione privata", 60, 40), s("Lezione di coppia", 60, 60)],
  },
  {
    id: "nuoto",
    category: "Sport",
    label: "Istruttore di nuoto",
    place: "scuola",
    articles: LA,
    staff: { one: "istruttore", many: "istruttori" },
    exampleName: "Scuola Nuoto Delfino",
    services: [s("Lezione bambini", 30, 25), s("Lezione privata", 45, 30), s("Lezione di coppia", 45, 45)],
  },
  {
    id: "scuola_guida",
    category: "Sport",
    label: "Scuola guida (lezioni pratiche)",
    place: "autoscuola",
    articles: L_,
    staff: { one: "istruttore", many: "istruttori" },
    exampleName: "Autoscuola Centrale",
    services: [s("Guida 30 minuti", 30, 22), s("Lezione di guida", 60, 40), s("Guida in autostrada", 60, 45), s("Simulazione d'esame", 60, 45)],
  },
  {
    id: "sci",
    category: "Sport",
    label: "Maestro di sci e snowboard",
    place: "scuola",
    articles: LA,
    staff: { one: "maestro", many: "maestri" },
    exampleName: "Scuola Sci Monte Bianco",
    services: [s("Lezione bambini", 60, 50), s("Lezione privata 1 ora", 60, 55), s("Lezione privata 2 ore", 120, 100)],
  },

  // --- Lezioni --------------------------------------------------------------
  {
    id: "musica",
    category: "Lezioni",
    label: "Scuola di musica",
    place: "scuola",
    articles: LA,
    staff: { one: "insegnante", many: "insegnanti" },
    exampleName: "Scuola di Musica Armonia",
    services: [s("Lezione 30 minuti", 30, 18), s("Lezione di pianoforte", 60, 30), s("Lezione di chitarra", 60, 30), s("Lezione di canto", 60, 35)],
  },
  {
    id: "ripetizioni",
    category: "Lezioni",
    label: "Ripetizioni",
    place: "centro",
    articles: IL,
    staff: { one: "insegnante", many: "insegnanti" },
    exampleName: "Centro Studi Ravenna",
    services: [s("Ripetizione", 60, 20), s("Ripetizione 90 minuti", 90, 28), s("Preparazione esame", 120, 40)],
  },
  {
    id: "lingue",
    category: "Lezioni",
    label: "Scuola di lingue",
    place: "scuola",
    articles: LA,
    staff: { one: "insegnante", many: "insegnanti" },
    exampleName: "Language Lab",
    services: [s("Lezione di prova", 30, 0), s("Conversazione", 30, 18), s("Lezione individuale", 60, 30)],
  },
  {
    id: "informatica",
    category: "Lezioni",
    label: "Lezioni di informatica",
    place: "studio",
    articles: LO,
    staff: { one: "docente", many: "docenti" },
    exampleName: "Digital Lab",
    services: [s("Lezione individuale", 60, 35), s("Lezione lunga", 90, 50), s("Aiuto con il proprio computer", 60, 40)],
  },
  {
    id: "coaching",
    category: "Lezioni",
    label: "Coach e mentor",
    place: "studio",
    articles: LO,
    staff: { one: "coach", many: "coach" },
    exampleName: "Studio Coaching Ravenna",
    services: [s("Sessione conoscitiva", 30, 0), s("Sessione di coaching", 60, 80), s("Sessione intensiva", 120, 150)],
  },
  {
    id: "lezioni_fotografia",
    category: "Lezioni",
    label: "Lezioni di fotografia",
    place: "studio",
    articles: LO,
    staff: { one: "fotografo", many: "fotografi" },
    exampleName: "Scuola di Fotografia Obiettivo",
    services: [s("Revisione portfolio", 60, 40), s("Lezione individuale", 90, 50), s("Uscita fotografica", 120, 70)],
  },

  // --- Professionisti -------------------------------------------------------
  {
    id: "consulenza",
    category: "Professionisti",
    label: "Studio di consulenza",
    place: "studio",
    articles: LO,
    staff: { one: "consulente", many: "consulenti" },
    exampleName: "Studio Rossi Consulenze",
    services: [s("Primo colloquio", 30, 0), s("Consulenza breve", 30, 45), s("Consulenza", 60, 80)],
  },
  {
    id: "fotografo",
    category: "Professionisti",
    label: "Studio fotografico",
    place: "studio",
    articles: LO,
    staff: { one: "fotografo", many: "fotografi" },
    exampleName: "Foto Studio Luce",
    services: [s("Foto tessera", 15, 10), s("Servizio ritratto", 60, 120), s("Book fotografico", 120, 200)],
  },
  {
    id: "avvocato",
    category: "Professionisti",
    label: "Studio legale",
    place: "studio",
    articles: LO,
    staff: { one: "avvocato", many: "avvocati" },
    exampleName: "Studio Legale Bianchi",
    services: [s("Primo colloquio", 30, 0), s("Consulenza", 60, 100), s("Revisione di un contratto", 90, 150)],
  },
  {
    id: "notaio",
    category: "Professionisti",
    label: "Studio notarile",
    place: "studio",
    articles: LO,
    staff: { one: "notaio", many: "notai" },
    exampleName: "Studio Notarile Verdi",
    services: [s("Primo colloquio", 30, 0), s("Consulenza preliminare", 60, 0), s("Firma dell'atto", 60, 0)],
  },
  {
    id: "immobiliare",
    category: "Professionisti",
    label: "Agenzia immobiliare",
    place: "agenzia",
    articles: L_,
    staff: { one: "agente", many: "agenti" },
    exampleName: "Casa Più Immobiliare",
    services: [s("Visita di un immobile", 30, 0), s("Consulenza mutuo", 45, 0), s("Valutazione gratuita", 60, 0)],
  },
  {
    id: "architetto",
    category: "Professionisti",
    label: "Studio di architettura",
    place: "studio",
    articles: LO,
    staff: { one: "architetto", many: "architetti" },
    exampleName: "Studio Forma",
    services: [s("Primo incontro", 60, 0), s("Sopralluogo", 60, 100), s("Consulenza interior design", 90, 120)],
  },
  {
    id: "wedding_planner",
    category: "Professionisti",
    label: "Wedding planner",
    place: "studio",
    articles: LO,
    staff: { one: "wedding planner", many: "wedding planner" },
    exampleName: "Sì Lo Voglio Eventi",
    services: [s("Primo incontro", 60, 0), s("Riunione organizzativa", 90, 80), s("Sopralluogo location", 120, 100)],
  },

  // --- Casa e servizi -------------------------------------------------------
  {
    id: "sartoria",
    category: "Casa e servizi",
    label: "Sartoria",
    place: "sartoria",
    articles: LA,
    staff: { one: "sarto", many: "sarti" },
    exampleName: "Sartoria Elena",
    services: [s("Consegna orli e modifiche", 15, 10), s("Prova abito", 30, 0), s("Presa misure abito su misura", 60, 0)],
  },
  {
    id: "calzolaio",
    category: "Casa e servizi",
    label: "Calzolaio",
    place: "laboratorio",
    articles: IL,
    staff: { one: "calzolaio", many: "calzolai" },
    exampleName: "Calzoleria Mario",
    services: [s("Riparazione tacchi", 15, 15), s("Risuolatura", 15, 35), s("Ritiro lavoro", 15, 0)],
  },
  {
    id: "riparazioni_tech",
    category: "Casa e servizi",
    label: "Riparazione smartphone e PC",
    place: "laboratorio",
    articles: IL,
    staff: { one: "tecnico", many: "tecnici" },
    exampleName: "Fix Lab",
    services: [s("Diagnosi gratuita", 15, 0), s("Cambio batteria", 30, 50), s("Cambio schermo smartphone", 60, 90), s("Assistenza computer", 60, 50)],
  },
  {
    id: "gommista",
    category: "Casa e servizi",
    label: "Gommista",
    place: "officina",
    articles: L_,
    staff: { one: "gommista", many: "gommisti" },
    exampleName: "Gomme Express",
    services: [s("Cambio gomme", 30, 40), s("Equilibratura", 30, 25), s("Convergenza", 30, 40)],
  },
  {
    id: "autolavaggio",
    category: "Casa e servizi",
    label: "Autolavaggio",
    place: "autolavaggio",
    articles: L_,
    staff: { one: "operatore", many: "operatori" },
    exampleName: "Lavaggio Splendor",
    services: [s("Lavaggio esterno", 30, 15), s("Lavaggio interno ed esterno", 60, 30), s("Igienizzazione abitacolo", 90, 60)],
  },
  {
    id: "officina",
    category: "Casa e servizi",
    label: "Officina meccanica",
    place: "officina",
    articles: L_,
    staff: { one: "meccanico", many: "meccanici" },
    exampleName: "Officina Rossi",
    services: [s("Diagnosi", 60, 50), s("Cambio olio", 60, 70), s("Tagliando", 120, 150)],
  },
  {
    id: "interventi_domicilio",
    category: "Casa e servizi",
    label: "Idraulico ed elettricista",
    place: "ditta",
    articles: LA,
    staff: { one: "tecnico", many: "tecnici" },
    exampleName: "Ditta Servizi Casa",
    services: [s("Sopralluogo", 60, 0), s("Intervento 1 ora", 60, 50), s("Intervento 2 ore", 120, 90)],
  },

  // --- Animali --------------------------------------------------------------
  {
    id: "toelettatura",
    category: "Animali",
    label: "Toelettatura",
    place: "toelettatura",
    articles: LA,
    staff: { one: "toelettatore", many: "toelettatori" },
    exampleName: "Toelettatura Fido",
    services: [s("Taglio unghie", 15, 10), s("Bagno cane piccolo", 60, 30), s("Bagno e taglio", 90, 45)],
    featured: { pitch: "Bagni e tagli per ogni taglia, con i tempi di ogni servizio già calcolati." },
  },
  {
    id: "addestramento_cani",
    category: "Animali",
    label: "Addestramento cani",
    place: "centro",
    articles: IL,
    staff: { one: "addestratore", many: "addestratori" },
    exampleName: "Centro Cinofilo Argo",
    services: [s("Lezione cuccioli", 45, 35), s("Lezione individuale", 60, 40), s("Valutazione comportamentale", 60, 50)],
  },
  {
    id: "pet_sitter",
    category: "Animali",
    label: "Pet sitter",
    place: "servizio",
    articles: IL,
    staff: { one: "pet sitter", many: "pet sitter" },
    exampleName: "Pet Care Ravenna",
    services: [s("Visita a domicilio", 30, 15), s("Visita lunga", 60, 25), s("Compagnia e gioco", 60, 20)],
  },
  {
    id: "dog_walker",
    category: "Animali",
    label: "Dog walker",
    place: "servizio",
    articles: IL,
    staff: { one: "dog walker", many: "dog walker" },
    exampleName: "Passeggiate a 4 zampe",
    services: [s("Passeggiata 30 minuti", 30, 10), s("Passeggiata 60 minuti", 60, 18), s("Passeggiata di gruppo", 60, 12)],
  },
];

export const DEFAULT_BUSINESS_TYPE = "parrucchiere";

export function isBusinessType(value: string) {
  return BUSINESS_TYPES.some((t) => t.id === value);
}

/** "il salone", "dello studio", "l'agenzia"… (con l'apostrofo non va lo spazio) */
export function placeWith(t: BusinessType, kind: "the" | "of") {
  const article = t.articles[kind];
  return `${article}${article.endsWith("'") ? "" : " "}${t.place}`;
}

/** Configurazione del tipo; se il valore è sconosciuto, quella predefinita */
export function businessType(id: string | null | undefined): BusinessType {
  return BUSINESS_TYPES.find((t) => t.id === id) ?? BUSINESS_TYPES[0];
}

/** Tipi raggruppati per categoria, nell'ordine di CATEGORIES */
export function typesByCategory() {
  return CATEGORIES.map((category) => ({ category, types: BUSINESS_TYPES.filter((t) => t.category === category) }));
}

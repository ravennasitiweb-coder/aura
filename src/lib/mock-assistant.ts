// Assistente simulato per la demo: regole semplici, nessuna chiamata a OpenAI.
// Nella Fase 5 lo sostituiremo con il modello vero, che userà le stesse
// funzioni (elenco servizi, orari liberi, crea prenotazione).

import { SERVICES, formatTime, staffById, type Appointment, type Service } from "./demo-data";
import { findFreeSlots, type Slot } from "./slots";

export type ChatState =
  | { step: "service" }
  | { step: "slot"; service: Service; slots: Slot[] }
  | { step: "name"; service: Service; slot: Slot }
  | { step: "done" };

export type Reply = {
  text: string;
  quickReplies: string[];
  next: ChatState;
  booking?: Omit<Appointment, "id">;
};

export const GREETING =
  "Ciao! Sono l'assistente di Salone Aurora. Dimmi che servizio ti serve e quando preferisci venire.";

export const FIRST_QUICK_REPLIES = ["Taglio uomo nel pomeriggio", "Colore", "Manicure stamattina"];

const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function detectService(text: string): Service | undefined {
  // Prima le parole chiave più lunghe, così "taglio uomo" vince su "taglio"
  const pairs = SERVICES.flatMap((s) => s.keywords.map((k) => ({ s, k })));
  pairs.sort((a, b) => b.k.length - a.k.length);
  return pairs.find(({ k }) => text.includes(k))?.s;
}

function detectFromMin(text: string): number | undefined {
  const at = text.match(/(?:alle|dalle|verso le)\s+(\d{1,2})(?:[:.](\d{2}))?/);
  if (at) return Number(at[1]) * 60 + Number(at[2] ?? 0);
  if (text.includes("pomeriggio")) return 14 * 60;
  if (text.includes("sera") || text.includes("tardi")) return 17 * 60;
  return undefined;
}

function slotLabel(slot: Slot) {
  return `${formatTime(slot.start)} con ${staffById(slot.staffId)?.name}`;
}

function proposeSlots(service: Service, appointments: Appointment[], fromMin?: number): Reply {
  const slots = findFreeSlots(service, appointments, { fromMin });
  if (slots.length === 0) {
    return {
      text: `Per ${service.name.toLowerCase()} oggi non c'è più posto in quella fascia. Vuoi che guardi un altro orario?`,
      quickReplies: ["In mattinata", "Nel pomeriggio"],
      next: { step: "slot", service, slots: [] },
    };
  }
  return {
    text: `${service.name} dura ${service.durationMin} minuti e costa ${service.priceEur} €. Oggi ho libero:`,
    quickReplies: slots.map(slotLabel),
    next: { step: "slot", service, slots },
  };
}

export function reply(input: string, state: ChatState, appointments: Appointment[]): Reply {
  const text = normalize(input.trim());

  if (state.step === "done") {
    return {
      text: "Vuoi prenotare un altro servizio? Dimmi pure quale.",
      quickReplies: FIRST_QUICK_REPLIES,
      next: { step: "service" },
    };
  }

  if (state.step === "service") {
    const service = detectService(text);
    if (!service) {
      return {
        text: "Posso prenotarti uno di questi servizi. Quale ti interessa?",
        quickReplies: SERVICES.map((s) => s.name),
        next: { step: "service" },
      };
    }
    return proposeSlots(service, appointments, detectFromMin(text));
  }

  if (state.step === "slot") {
    const other = detectService(text);
    if (other && other.id !== state.service.id) {
      return proposeSlots(other, appointments, detectFromMin(text));
    }
    const chosen =
      state.slots.find((s) => text.startsWith(normalize(slotLabel(s))) || text.includes(formatTime(s.start))) ??
      (text.includes("prima") ? state.slots[0] : undefined);
    if (!chosen) {
      const fromMin = text.includes("mattin") ? undefined : detectFromMin(text);
      return proposeSlots(state.service, appointments, fromMin);
    }
    return {
      text: `Perfetto, ${formatTime(chosen.start)} con ${staffById(chosen.staffId)?.name}. A che nome prenoto?`,
      quickReplies: [],
      next: { step: "name", service: state.service, slot: chosen },
    };
  }

  // step "name"
  const customer = input.trim().replace(/^(mi chiamo|sono)\s+/i, "").slice(0, 40);
  if (customer.length < 2) {
    return { text: "Mi scrivi il tuo nome?", quickReplies: [], next: state };
  }
  const { service, slot } = state;
  return {
    text: `Fatto, ${customer}! Ti aspettiamo oggi alle ${formatTime(slot.start)} per ${service.name.toLowerCase()} con ${staffById(slot.staffId)?.name}. Ti arriverà un promemoria.`,
    quickReplies: ["Prenota un altro servizio"],
    next: { step: "done" },
    booking: {
      staffId: slot.staffId,
      serviceId: service.id,
      customer,
      start: slot.start,
      end: slot.end,
      source: "chatbot",
    },
  };
}

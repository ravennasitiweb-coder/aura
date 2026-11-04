import { SALON, STAFF_SERVICES, type Appointment, type Service } from "./demo-data";

export type Slot = {
  staffId: string;
  start: number;
  end: number;
};

const STEP_MIN = 30;

/**
 * Trova gli orari liberi per un servizio, controllando che l'operatore
 * lo sappia fare e che non si sovrapponga ad altri appuntamenti.
 * È la stessa regola che il chatbot vero userà come "funzione".
 */
export function findFreeSlots(
  service: Service,
  appointments: Appointment[],
  opts: { fromMin?: number; limit?: number } = {},
): Slot[] {
  const { fromMin = SALON.openMin, limit = 3 } = opts;
  const staffIds = Object.entries(STAFF_SERVICES)
    .filter(([, services]) => services.includes(service.id))
    .map(([staffId]) => staffId);

  const slots: Slot[] = [];
  const firstStart = Math.max(SALON.openMin, Math.ceil(fromMin / STEP_MIN) * STEP_MIN);

  for (let start = firstStart; start + service.durationMin <= SALON.closeMin; start += STEP_MIN) {
    const end = start + service.durationMin;
    for (const staffId of staffIds) {
      const busy = appointments.some(
        (a) => a.staffId === staffId && a.start < end && start < a.end,
      );
      if (!busy) {
        slots.push({ staffId, start, end });
        break;
      }
    }
    if (slots.length >= limit) break;
  }
  return slots;
}

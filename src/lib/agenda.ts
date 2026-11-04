// Logica dell'agenda senza accesso al database: facile da testare.
// Gli orari sono in minuti dalla mezzanotte locale (9:30 = 570).

export type TimeRange = { start: number; end: number };
export type BusyBlock = { staffId: string; start: number; end: number };
export type FreeSlot = { staffId: string; start: number };

const SLOT_STEP_MIN = 15;

/**
 * Orari in cui un servizio di `durationMin` può iniziare, per ogni
 * collaboratore indicato: dentro una fascia di apertura (senza sforare
 * la chiusura o la pausa) e senza sovrapporsi ad altri appuntamenti.
 */
export function computeFreeSlots(opts: {
  openRanges: TimeRange[];
  staffIds: string[];
  busy: BusyBlock[];
  durationMin: number;
  notBeforeMin?: number;
}): FreeSlot[] {
  const { openRanges, staffIds, busy, durationMin, notBeforeMin = 0 } = opts;
  const slots: FreeSlot[] = [];

  for (const range of openRanges) {
    const first = Math.max(range.start, Math.ceil(notBeforeMin / SLOT_STEP_MIN) * SLOT_STEP_MIN);
    for (let start = first; start + durationMin <= range.end; start += SLOT_STEP_MIN) {
      const end = start + durationMin;
      for (const staffId of staffIds) {
        const overlaps = busy.some((b) => b.staffId === staffId && b.start < end && start < b.end);
        if (!overlaps) slots.push({ staffId, start });
      }
    }
  }
  return slots.sort((a, b) => a.start - b.start);
}

// Date ------------------------------------------------------------------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDate(value: string) {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function addDays(date: string, days: number) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// 1 = lunedì ... 7 = domenica
export function isoWeekday(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7;
}

// Data di oggi e minuti attuali nel fuso del salone
export function nowInTimezone(timeZone: string, now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

export function formatLongDate(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

export function minutesToTime(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

export function timeToMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

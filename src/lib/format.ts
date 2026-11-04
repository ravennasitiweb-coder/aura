export const WEEKDAYS = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];

export function formatPrice(cents: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(cents / 100);
}

// "45" o "45,50" o "45.5" → 4550 centesimi; null se non è un prezzo valido
export function parsePriceToCents(input: string): number | null {
  const clean = input.trim().replace("€", "").replace(",", ".");
  if (clean === "") return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}

export function centsToInput(cents: number) {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2).replace(".", ",");
}

export function formatDuration(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

// "09:00:00" (dal database) → "09:00"
export function shortTime(t: string) {
  return t.slice(0, 5);
}

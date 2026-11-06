// Assistente della sala: regole semplici, senza AI e senza database.
// Misure in centimetri; il centro di ogni tavolo è (x, y).

/** Lato del tavolo in cm, in base ai posti (lo stesso usato per disegnarlo) */
export const tableSize = (seats: number) => Math.min(60 + seats * 15, 260);

/** Spazio intorno al tavolo per le sedie e il passaggio dei camerieri */
export const AISLE_CM = 90;
/** Superficie media per coperto in una sala ristorante (1,4 m²) */
const M2_PER_COVER = 1.4;

export type PlacedTable = { id: string; seats: number; x: number; y: number };

/** Coperti che la sala può ospitare comodamente */
export function estimateCovers(widthCm: number, depthCm: number) {
  return Math.floor((widthCm / 100) * (depthCm / 100) / M2_PER_COVER);
}

/**
 * Tavoli consigliati per arrivare ai coperti della sala, oltre a quelli che ci sono già:
 * circa un terzo dei coperti su tavoli da 2, la maggior parte da 4, qualcuno da 6.
 */
export function suggestTables(widthCm: number, depthCm: number, currentSeats: number) {
  const missing = estimateCovers(widthCm, depthCm) - currentSeats;
  if (missing < 2) return [];
  const twos = Math.round((missing * 0.3) / 2);
  const sixes = missing >= 24 ? Math.round((missing * 0.15) / 6) : 0;
  const fours = Math.max(0, Math.floor((missing - twos * 2 - sixes * 6) / 4));
  return [
    { count: twos, seats: 2 },
    { count: fours, seats: 4 },
    { count: sixes, seats: 6 },
  ].filter((s) => s.count > 0);
}

/**
 * Sistema i tavoli a file ordinate, dai più grandi ai più piccoli, lasciando
 * il passaggio tra uno e l'altro. Restituisce le posizioni e i tavoli che non ci stanno.
 */
export function autoArrange(tables: { id: string; seats: number }[], widthCm: number, depthCm: number) {
  const placed: PlacedTable[] = [];
  const left: string[] = [];
  const sorted = [...tables].sort((a, b) => b.seats - a.seats);
  let x = AISLE_CM / 2;
  let y = AISLE_CM / 2;
  let rowHeight = 0;
  for (const t of sorted) {
    const s = tableSize(t.seats);
    if (x + s > widthCm - AISLE_CM / 2 && x > AISLE_CM / 2) {
      x = AISLE_CM / 2;
      y += rowHeight + AISLE_CM;
      rowHeight = 0;
    }
    if (x + s > widthCm - AISLE_CM / 2 || y + s > depthCm - AISLE_CM / 2) {
      left.push(t.id);
      continue;
    }
    placed.push({ id: t.id, seats: t.seats, x: Math.round(x + s / 2), y: Math.round(y + s / 2) });
    x += s + AISLE_CM;
    rowHeight = Math.max(rowHeight, s);
  }
  return { placed, left };
}

/** Problemi della disposizione: tavoli fuori dalla sala o troppo vicini per passare */
export function checkLayout(tables: PlacedTable[], widthCm: number, depthCm: number, names: Record<string, string>) {
  const problems: string[] = [];
  for (const t of tables) {
    const h = tableSize(t.seats) / 2;
    if (t.x - h < 0 || t.y - h < 0 || t.x + h > widthCm || t.y + h > depthCm) problems.push(`${names[t.id]} esce dalla sala.`);
  }
  // Serve almeno mezzo passaggio (45 cm) tra i bordi di due tavoli vicini
  for (let i = 0; i < tables.length; i++) {
    for (let j = i + 1; j < tables.length; j++) {
      const a = tables[i];
      const b = tables[j];
      const gapX = Math.abs(a.x - b.x) - (tableSize(a.seats) + tableSize(b.seats)) / 2;
      const gapY = Math.abs(a.y - b.y) - (tableSize(a.seats) + tableSize(b.seats)) / 2;
      if (Math.max(gapX, gapY) < AISLE_CM / 2) problems.push(`${names[a.id]} e ${names[b.id]} sono troppo vicini.`);
    }
  }
  return problems;
}

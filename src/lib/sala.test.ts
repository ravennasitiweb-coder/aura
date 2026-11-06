import assert from "node:assert/strict";
import { test } from "node:test";
import { autoArrange, checkLayout, estimateCovers, suggestTables } from "./sala.ts";

test("stima dei coperti: 10 × 8 m = 57", () => {
  assert.equal(estimateCovers(1000, 800), 57);
});

test("i tavoli consigliati coprono quasi tutti i coperti mancanti", () => {
  const s = suggestTables(1000, 800, 0);
  const seats = s.reduce((n, t) => n + t.count * t.seats, 0);
  assert.ok(seats <= 57 && seats >= 50, `posti consigliati: ${seats}`);
  assert.deepEqual(suggestTables(1000, 800, 60), []);
});

test("la disposizione automatica non crea problemi e segnala chi non ci sta", () => {
  const tables = Array.from({ length: 12 }, (_, i) => ({ id: `t${i}`, seats: i < 4 ? 2 : 4 }));
  const names = Object.fromEntries(tables.map((t) => [t.id, t.id]));
  const { placed, left } = autoArrange(tables, 1000, 800);
  assert.equal(placed.length + left.length, 12);
  assert.deepEqual(checkLayout(placed, 1000, 800, names), []);
  const tiny = autoArrange(tables, 300, 300);
  assert.ok(tiny.left.length > 0);
});

test("segnala tavoli sovrapposti o fuori dalla sala", () => {
  const p = checkLayout(
    [
      { id: "a", seats: 4, x: 100, y: 100 },
      { id: "b", seats: 4, x: 150, y: 100 },
      { id: "c", seats: 2, x: 990, y: 400 },
    ],
    1000,
    800,
    { a: "T1", b: "T2", c: "T3" },
  );
  assert.ok(p.includes("T1 e T2 sono troppo vicini."));
  assert.ok(p.includes("T3 esce dalla sala."));
});

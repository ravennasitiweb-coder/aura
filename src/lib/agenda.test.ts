import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays, computeFreeSlots, isValidDate, isoWeekday, nowInTimezone } from "./agenda.ts";

const t = (h: number, m = 0) => h * 60 + m;

test("non propone orari che sforano la chiusura o la pausa", () => {
  const slots = computeFreeSlots({
    openRanges: [{ start: t(9), end: t(13) }, { start: t(15), end: t(19) }],
    staffIds: ["giulia"],
    busy: [],
    durationMin: 60,
  });
  const starts = slots.map((s) => s.start);
  assert.ok(starts.includes(t(12)), "12:00-13:00 sta prima della pausa");
  assert.ok(!starts.includes(t(12, 15)), "12:15 finirebbe in pausa");
  assert.ok(!starts.includes(t(13)), "in pausa non si inizia");
  assert.equal(starts.at(-1), t(18), "l'ultimo inizio utile è 18:00");
});

test("salta gli orari occupati solo per il collaboratore impegnato", () => {
  const slots = computeFreeSlots({
    openRanges: [{ start: t(9), end: t(11) }],
    staffIds: ["giulia", "marco"],
    busy: [{ staffId: "giulia", start: t(9, 30), end: t(10) }],
    durationMin: 30,
  });
  const giulia = slots.filter((s) => s.staffId === "giulia").map((s) => s.start);
  const marco = slots.filter((s) => s.staffId === "marco").map((s) => s.start);
  assert.deepEqual(giulia, [t(9), t(10), t(10, 15), t(10, 30)]);
  assert.equal(marco.length, 7);
});

test("oggi non propone orari già passati", () => {
  const slots = computeFreeSlots({
    openRanges: [{ start: t(9), end: t(12) }],
    staffIds: ["giulia"],
    busy: [],
    durationMin: 30,
    notBeforeMin: t(10, 7),
  });
  assert.equal(slots[0].start, t(10, 15));
});

test("date", () => {
  assert.equal(isValidDate("2026-02-29"), false);
  assert.equal(isValidDate("2028-02-29"), true);
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(isoWeekday("2026-11-04"), 3, "4 novembre 2026 è mercoledì");
  assert.equal(isoWeekday("2026-11-08"), 7, "8 novembre 2026 è domenica");
});

test("ora legale: Roma è UTC+2 d'estate e UTC+1 d'inverno", () => {
  assert.deepEqual(nowInTimezone("Europe/Rome", new Date("2026-07-01T08:00:00Z")), { date: "2026-07-01", minutes: t(10) });
  assert.deepEqual(nowInTimezone("Europe/Rome", new Date("2026-12-01T08:00:00Z")), { date: "2026-12-01", minutes: t(9) });
  assert.deepEqual(nowInTimezone("Europe/Rome", new Date("2026-12-31T23:30:00Z")), { date: "2027-01-01", minutes: t(0, 30) });
});

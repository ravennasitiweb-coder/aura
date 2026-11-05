import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { BUSINESS_TYPES, businessType, isBusinessType } from "./business-types.ts";

test("ogni tipo di attività è completo e valido", () => {
  const ids = new Set<string>();
  for (const t of BUSINESS_TYPES) {
    assert.ok(!ids.has(t.id), `id ripetuto: ${t.id}`);
    ids.add(t.id);
    assert.ok(t.label && t.place && t.staff.one && t.staff.many && t.exampleName && t.pitch, `${t.id}: testi mancanti`);
    assert.ok(["il", "lo", "la"].includes(t.articles.the), `${t.id}: articolo non valido`);
    assert.ok(t.services.length >= 3, `${t.id}: servono almeno 3 servizi di esempio`);
    for (const s of t.services) {
      // Stesse regole del database e del modulo Servizi
      assert.ok(s.name.length >= 2 && s.name.length <= 80, `${t.id}: nome servizio non valido`);
      assert.ok(s.durationMin >= 5 && s.durationMin <= 480 && s.durationMin % 15 === 0, `${t.id}: durata non valida (${s.durationMin})`);
      assert.ok(s.priceEur >= 0, `${t.id}: prezzo negativo`);
    }
  }
});

test("gli id coincidono con quelli ammessi dal database", () => {
  const dir = new URL("../../supabase/migrations/", import.meta.url);
  const sql = readdirSync(dir).filter((f) => f.includes("tipi_di_attivita")).map((f) => readFileSync(new URL(f, dir), "utf8")).join("\n");
  const block = sql.match(/business_type in \(([\s\S]*?)\)/)?.[1] ?? "";
  const dbIds = [...block.matchAll(/'(\w+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(dbIds, BUSINESS_TYPES.map((t) => t.id).sort());
});

test("valori sconosciuti ricadono sul tipo predefinito", () => {
  assert.equal(businessType("tatuatore").label, "Studio tatuaggi");
  assert.equal(businessType("ristorante").id, "parrucchiere");
  assert.equal(businessType(null).id, "parrucchiere");
  assert.equal(isBusinessType("barbiere"), true);
  assert.equal(isBusinessType("<script>"), false);
});

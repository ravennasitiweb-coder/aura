import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { BUSINESS_TYPES, CATEGORIES, businessType, isBusinessType, placeWith, typesByCategory } from "./business-types.ts";

const VOWEL = /^[aeiouàèéìòù]/i;
// "lo" davanti a s+consonante, z, gn, ps, x, y (lo studio, lo zaino)
const NEEDS_LO = /^(s[^aeiouàèéìòù]|z|gn|ps|x|y)/i;

test("ogni tipo di attività è completo e valido", () => {
  const ids = new Set<string>();
  const labels = new Set<string>();
  for (const t of BUSINESS_TYPES) {
    assert.match(t.id, /^[a-z][a-z_]*$/, `${t.id}: id con caratteri non ammessi`);
    assert.ok(!ids.has(t.id), `id ripetuto: ${t.id}`);
    assert.ok(!labels.has(t.label), `nome ripetuto: ${t.label}`);
    ids.add(t.id);
    labels.add(t.label);
    assert.ok(CATEGORIES.includes(t.category), `${t.id}: categoria sconosciuta`);
    assert.ok(t.label && t.place && t.staff.one && t.staff.many && t.exampleName, `${t.id}: testi mancanti`);
    assert.ok(t.label.length <= 40, `${t.id}: nome troppo lungo per il menu`);

    assert.ok(t.services.length >= 3, `${t.id}: servono almeno 3 servizi di esempio`);
    assert.equal(new Set(t.services.map((s) => s.name)).size, t.services.length, `${t.id}: servizi ripetuti`);
    for (const s of t.services) {
      // Stesse regole del database e del modulo Servizi
      assert.ok(s.name.length >= 2 && s.name.length <= 80, `${t.id}: nome servizio non valido`);
      assert.ok(s.durationMin >= 15 && s.durationMin <= 480 && s.durationMin % 15 === 0, `${t.id}: durata non valida (${s.durationMin})`);
      assert.ok(Number.isInteger(s.priceEur * 100) && s.priceEur >= 0, `${t.id}: prezzo non valido`);
    }
  }
});

test("gli articoli sono italiani corretti", () => {
  const PAIRS: Record<string, string> = { il: "del", lo: "dello", la: "della", "l'": "dell'" };
  for (const t of BUSINESS_TYPES) {
    assert.equal(t.articles.of, PAIRS[t.articles.the], `${t.id}: "${t.articles.the}" e "${t.articles.of}" non vanno insieme`);
    if (VOWEL.test(t.place)) {
      assert.equal(t.articles.the, "l'", `${t.id}: davanti a vocale serve l' (${t.place})`);
    } else {
      assert.notEqual(t.articles.the, "l'", `${t.id}: l' solo davanti a vocale (${t.place})`);
      // Solo per i maschili: "lo studio" ma "il salone"; i femminili usano sempre "la"
      if (t.articles.the !== "la") {
        assert.equal(t.articles.the, NEEDS_LO.test(t.place) ? "lo" : "il", `${t.id}: articolo maschile sbagliato (${t.place})`);
      }
    }
  }
  assert.equal(placeWith(businessType("immobiliare"), "the"), "l'agenzia");
  assert.equal(placeWith(businessType("immobiliare"), "of"), "dell'agenzia");
  assert.equal(placeWith(businessType("tatuatore"), "of"), "dello studio");
  assert.equal(placeWith(businessType("barbiere"), "the"), "la barberia");
  assert.equal(placeWith(businessType("parrucchiere"), "of"), "del salone");
});

test("attività in evidenza nella landing: 8, con la loro frase", () => {
  const featured = BUSINESS_TYPES.filter((t) => t.featured);
  assert.equal(featured.length, 8);
  for (const t of featured) assert.ok(t.featured!.pitch.length > 20, `${t.id}: frase troppo corta`);
});

test("ogni categoria ha almeno un'attività e nessuna resta fuori", () => {
  const grouped = typesByCategory();
  assert.equal(grouped.reduce((n, g) => n + g.types.length, 0), BUSINESS_TYPES.length);
  for (const g of grouped) assert.ok(g.types.length > 0, `categoria vuota: ${g.category}`);
});

test("gli id coincidono con quelli ammessi dall'ultima migrazione del database", () => {
  const dir = new URL("../../supabase/migrations/", import.meta.url);
  const files = readdirSync(dir).filter((f) => f.includes("tipi_di_attivita")).sort();
  // Vale l'ultima migrazione che definisce l'elenco
  const lists = files
    .map((f) => readFileSync(new URL(f, dir), "utf8").match(/business_type in \(([\s\S]*?)\)/)?.[1])
    .filter((x): x is string => Boolean(x));
  const last = lists.at(-1) ?? "";
  const dbIds = [...last.matchAll(/'(\w+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(dbIds, BUSINESS_TYPES.map((t) => t.id).sort());
});

test("valori sconosciuti ricadono sul tipo predefinito", () => {
  assert.equal(businessType("tatuatore").label, "Studio tatuaggi");
  assert.equal(businessType("ristorante").id, "parrucchiere");
  assert.equal(businessType(null).id, "parrucchiere");
  assert.equal(isBusinessType("lash_maker"), true);
  assert.equal(isBusinessType("<script>"), false);
});

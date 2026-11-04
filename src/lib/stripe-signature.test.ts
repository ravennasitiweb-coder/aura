import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { verifyStripeSignature } from "./stripe-signature.ts";

const sign = (payload: string, secret: string, t: number) =>
  `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex")}`;

test("firma Stripe: accetta solo messaggi autentici e recenti", () => {
  const secret = "whsec_test";
  const payload = '{"type":"checkout.session.completed"}';
  const now = 1_800_000_000;

  assert.equal(verifyStripeSignature(payload, sign(payload, secret, now), secret, now), true, "firma valida");
  assert.equal(verifyStripeSignature(payload + " ", sign(payload, secret, now), secret, now), false, "contenuto modificato");
  assert.equal(verifyStripeSignature(payload, sign(payload, "altro", now), secret, now), false, "segreto sbagliato");
  assert.equal(verifyStripeSignature(payload, sign(payload, secret, now - 600), secret, now), false, "messaggio vecchio");
  assert.equal(verifyStripeSignature(payload, null, secret, now), false, "senza firma");
  assert.equal(verifyStripeSignature(payload, "t=abc,v1=", secret, now), false, "intestazione rotta");
  assert.equal(verifyStripeSignature(payload, sign(payload, secret, now), "", now), false, "segreto non configurato");
});

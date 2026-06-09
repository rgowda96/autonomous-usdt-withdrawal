import { test } from "node:test";
import assert from "node:assert/strict";

const { redact } = await import("../src/services/logging.js");

test("redact masks auth_proof", () => {
  const out = redact({ auth_proof: "passkey-assertion-aaaa", x: 1 }) as any;
  assert.equal(out.auth_proof, "[redacted]");
  assert.equal(out.x, 1);
});

test("redact masks signature headers (case-insensitive)", () => {
  const out = redact({ "X-Signature": "abc", Authorization: "Bearer x" }) as any;
  assert.equal(out["X-Signature"], "[redacted]");
  assert.equal(out.Authorization, "[redacted]");
});

test("redact masks VPAs in identifier fields", () => {
  const out = redact({ payee: { type: "vpa", identifier: "rohit@hdfc" } }) as any;
  assert.equal(out.payee.identifier, "ro***@hdfc");
});

test("redact preserves UUIDs and amounts", () => {
  const out = redact({
    idempotency_key: "11111111-1111-1111-1111-111111111111",
    amount_inr: 500,
    user_id: "user_x",
  }) as any;
  assert.equal(out.idempotency_key, "11111111-1111-1111-1111-111111111111");
  assert.equal(out.amount_inr, 500);
  assert.equal(out.user_id, "user_x");
});

test("redact handles nested arrays", () => {
  const out = redact({ steps: [{ auth_proof: "x" }, { ok: 1 }] }) as any;
  assert.equal(out.steps[0].auth_proof, "[redacted]");
  assert.equal(out.steps[1].ok, 1);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

process.env.DATABASE_URL = `./data/test-onmeta-${process.pid}.db`;

const { OnmetaAdapter, FallbackOffRamp } = await import("../src/services/offramp_onmeta.js");

test("payout fails fast when ONMETA_API_KEY missing", async () => {
  const a = new OnmetaAdapter("https://example.invalid/v1", "");
  const r = await a.payout({ client_ref: "q_1", vpa: "x@y", amount_inr: 100 });
  assert.equal(r.status, "FAILED");
  assert.match(r.reason ?? "", /ONMETA_API_KEY missing/);
});

test("verifyWebhook accepts valid HMAC-SHA256", () => {
  const a = new OnmetaAdapter("https://example.invalid/v1", "key");
  process.env.ONMETA_WEBHOOK_SECRET = "test-secret";
  const payload = '{"event":"PAYOUT_SUCCESS","id":"r1"}';
  const sig = createHmac("sha256", "test-secret").update(payload).digest("hex");
  assert.equal(a.verifyWebhook(payload, sig), true);
});

test("verifyWebhook rejects invalid HMAC", () => {
  process.env.ONMETA_WEBHOOK_SECRET = "test-secret";
  const a = new OnmetaAdapter("https://example.invalid/v1", "key");
  const payload = '{"event":"PAYOUT_SUCCESS","id":"r1"}';
  assert.equal(a.verifyWebhook(payload, "deadbeef"), false);
});

test("FallbackOffRamp falls back when primary fails", async () => {
  const failing = {
    payout: async () => ({ provider_ref: "", status: "FAILED" as const, reason: "down" }),
    verifyWebhook: () => false,
  };
  const ok = {
    payout: async () => ({ provider_ref: "MOCK_OK", status: "ACCEPTED" as const }),
    verifyWebhook: () => true,
  };
  const f = new FallbackOffRamp(failing, ok);
  const r = await f.payout({ client_ref: "x", vpa: "x@y", amount_inr: 10 });
  assert.equal(r.status, "ACCEPTED");
  assert.equal(r.provider_ref, "MOCK_OK");
});

test("FallbackOffRamp uses primary on success (no fallback)", async () => {
  let fallbackCalled = false;
  const ok = {
    payout: async () => ({ provider_ref: "PRIMARY_OK", status: "ACCEPTED" as const }),
    verifyWebhook: () => true,
  };
  const fb = {
    payout: async () => { fallbackCalled = true; return { provider_ref: "", status: "FAILED" as const }; },
    verifyWebhook: () => false,
  };
  const f = new FallbackOffRamp(ok, fb);
  const r = await f.payout({ client_ref: "x", vpa: "x@y", amount_inr: 10 });
  assert.equal(r.status, "ACCEPTED");
  assert.equal(r.provider_ref, "PRIMARY_OK");
  assert.equal(fallbackCalled, false);
});

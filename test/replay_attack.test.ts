import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

process.env.DATABASE_URL = `./data/test-replay-${process.pid}.db`;

const { db, now } = await import("../src/db/index.js");
const { _resetRateLimits } = await import("../src/services/rate_limit.js");
const { registerQuoteRoutes } = await import("../src/routes/quote.js");
const { registerSettleRoutes } = await import("../src/routes/settle.js");
const { registerWebhookRoutes } = await import("../src/routes/webhook.js");
const { createSessionKey } = await import("../src/services/session_keys.js");
const { registerAgentRoutes } = await import("../src/routes/agent.js");
const Fastify = (await import("fastify")).default;

function reset() {
  _resetRateLimits();
  db().exec(`
    DELETE FROM notifications;
    DELETE FROM session_key_usage;
    DELETE FROM session_keys;
    DELETE FROM webhook_events;
    DELETE FROM tds_accruals;
    DELETE FROM transaction_events;
    DELETE FROM transactions;
    DELETE FROM quotes;
    DELETE FROM balances;
    DELETE FROM users;
  `);
}
function seed(id: string) {
  db().prepare(`INSERT OR IGNORE INTO users (id, created_at, kyc_status) VALUES (?, ?, ?)`).run(id, now(), "approved");
  db().prepare(`INSERT INTO balances (user_id, asset, chain, amount, updated_at) VALUES (?, ?, ?, ?, ?)`)
    .run(id, "INR_CREDIT", "internal", "100000", now());
}
async function app() {
  const a = Fastify();
  await registerQuoteRoutes(a);
  await registerSettleRoutes(a);
  await registerWebhookRoutes(a);
  await registerAgentRoutes(a);
  return a;
}

test("replay /v1/quote with same idempotency_key returns same quote (no duplicate)", async () => {
  reset();
  seed("u_r1");
  const a = await app();
  const idem = randomUUID();
  const body = {
    idempotency_key: idem,
    user_id: "u_r1",
    payee: { type: "vpa", identifier: "x@y" },
    amount_inr: 100,
    channel: "qr",
    asset_preference: "auto_cheapest",
  };
  const r1 = await a.inject({ method: "POST", url: "/v1/quote", payload: body });
  const r2 = await a.inject({ method: "POST", url: "/v1/quote", payload: body });
  assert.equal(r1.statusCode, 200);
  assert.equal(r2.statusCode, 200);
  assert.equal(r1.json().quote_id, r2.json().quote_id);
});

test("replay /v1/settle with same key returns same tx (no double-debit)", async () => {
  reset();
  seed("u_r2");
  const a = await app();
  const q = await a.inject({
    method: "POST",
    url: "/v1/quote",
    payload: {
      idempotency_key: randomUUID(),
      user_id: "u_r2",
      payee: { type: "vpa", identifier: "x@y" },
      amount_inr: 100,
      channel: "qr",
      asset_preference: "auto_cheapest",
    },
  });
  const qid = q.json().quote_id;
  const idem = randomUUID();
  const s1 = await a.inject({
    method: "POST",
    url: "/v1/settle",
    payload: { idempotency_key: idem, quote_id: qid, auth_proof: "stub-passkey-x" },
  });
  const s2 = await a.inject({
    method: "POST",
    url: "/v1/settle",
    payload: { idempotency_key: idem, quote_id: qid, auth_proof: "stub-passkey-x" },
  });
  assert.equal(s1.json().transaction_id, s2.json().transaction_id);
  const balRow = db().prepare(`SELECT amount FROM balances WHERE user_id = ? AND asset = ?`).get("u_r2", "INR_CREDIT") as any;
  // Started at 100000; settled 100 INR ONCE
  assert.ok(parseFloat(balRow.amount) > 99800 && parseFloat(balRow.amount) < 99950);
});

test("webhook event_id is deduped (replay attack)", async () => {
  reset();
  seed("u_r3");
  const a = await app();
  const q = await a.inject({
    method: "POST",
    url: "/v1/quote",
    payload: {
      idempotency_key: randomUUID(),
      user_id: "u_r3",
      payee: { type: "vpa", identifier: "x@y" },
      amount_inr: 50,
      channel: "qr",
      asset_preference: "auto_cheapest",
    },
  });
  const qid = q.json().quote_id;
  await a.inject({
    method: "POST",
    url: "/v1/settle",
    payload: { idempotency_key: randomUUID(), quote_id: qid, auth_proof: "stub-passkey-x" },
  });
  const evt = {
    event_id: "evt_replay_1",
    event_type: "PAYOUT_SUCCESS",
    client_ref: qid,
    provider_ref: "ref1",
    utr: "UTR111111111",
  };
  const w1 = await a.inject({
    method: "POST",
    url: "/v1/webhooks/offramp",
    headers: { "x-signature": "devsecret" },
    payload: evt,
  });
  const w2 = await a.inject({
    method: "POST",
    url: "/v1/webhooks/offramp",
    headers: { "x-signature": "devsecret" },
    payload: evt,
  });
  assert.equal(w1.statusCode, 200);
  assert.equal(w2.statusCode, 200);
  assert.equal(w2.json().dedup, true);
});

test("webhook rejected without signature header", async () => {
  reset();
  const a = await app();
  const r = await a.inject({
    method: "POST",
    url: "/v1/webhooks/offramp",
    payload: { event_id: "x", event_type: "PAYOUT_SUCCESS", client_ref: "q_x", provider_ref: "r" },
  });
  assert.equal(r.statusCode, 401);
});

test("agent token stolen + replayed against revoked key is rejected", async () => {
  reset();
  seed("u_r4");
  const sk = createSessionKey({ user_id: "u_r4", label: "L", daily_cap_inr: 1000, per_txn_cap_inr: 500, ttl_days: 30 });
  db().prepare(`UPDATE session_keys SET revoked_at = ? WHERE id = ?`).run(Date.now(), sk.id);
  const a = await app();
  const r = await a.inject({
    method: "POST",
    url: "/v1/agent/pay-upi",
    headers: { authorization: `Bearer ${sk.token}` },
    payload: { vpa: "x@y", amount_inr: 100 },
  });
  assert.equal(r.statusCode, 403);
});

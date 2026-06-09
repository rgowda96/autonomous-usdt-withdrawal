import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

process.env.DATABASE_URL = `./data/test-intent-routes-${process.pid}.db`;

const { db, now } = await import("../src/db/index.js");
const { registerIntentRoutes } = await import("../src/routes/intents.js");
const Fastify = (await import("fastify")).default;

function reset() {
  db().exec(`
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

test("parse UPI deeplink via endpoint", async () => {
  reset();
  seed("u_int_1");
  const app = Fastify();
  await registerIntentRoutes(app);
  const r = await app.inject({
    method: "POST",
    url: "/v1/intents/parse",
    payload: { input: "upi://pay?pa=cafe@hdfc&pn=Cafe&am=120&cu=INR", user_id: "u_int_1" },
  });
  assert.equal(r.statusCode, 200);
  const b = r.json();
  assert.equal(b.intent.payee.identifier, "cafe@hdfc");
  assert.equal(b.intent.amount.value, 120);
  assert.equal(b.intent.channel, "qr");
});

test("submit parsed intent returns quote", async () => {
  reset();
  seed("u_int_2");
  const app = Fastify();
  await registerIntentRoutes(app);
  const parse = await app.inject({
    method: "POST",
    url: "/v1/intents/parse",
    payload: { input: "upi://pay?pa=x@y&am=200&cu=INR", user_id: "u_int_2" },
  });
  const intent = parse.json().intent;
  const submit = await app.inject({
    method: "POST",
    url: "/v1/intents/submit",
    payload: { user_id: "u_int_2", intent, idempotency_key: randomUUID() },
  });
  assert.equal(submit.statusCode, 200);
  const q = submit.json();
  assert.ok(q.quote_id.startsWith("q_"));
  assert.equal(q.amount_inr, 200);
});

test("checkout body parses to checkout channel", async () => {
  reset();
  seed("u_int_3");
  const app = Fastify();
  await registerIntentRoutes(app);
  const r = await app.inject({
    method: "POST",
    url: "/v1/intents/parse",
    payload: {
      input: JSON.stringify({ merchant: { vpa: "store@bank", name: "Store" }, amount_inr: 400, order_ref: "O1" }),
      user_id: "u_int_3",
    },
  });
  assert.equal(r.statusCode, 200);
  assert.equal(r.json().intent.channel, "checkout");
});

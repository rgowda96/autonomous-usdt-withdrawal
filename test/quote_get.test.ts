import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

process.env.DATABASE_URL = `./data/test-quote-${process.pid}.db`;

const { db, now } = await import("../src/db/index.js");
const { createQuote } = await import("../src/services/quote.js");
const { registerQuoteRoutes } = await import("../src/routes/quote.js");
const Fastify = (await import("fastify")).default;

function resetDb() {
  const conn = db();
  conn.exec(`
    DELETE FROM webhook_events;
    DELETE FROM tds_accruals;
    DELETE FROM transaction_events;
    DELETE FROM transactions;
    DELETE FROM quotes;
    DELETE FROM balances;
    DELETE FROM users;
  `);
}

function seedUser(userId: string) {
  const conn = db();
  conn.prepare(`INSERT INTO users (id, created_at, kyc_status) VALUES (?, ?, ?)`)
    .run(userId, now(), "approved");
  conn.prepare(`INSERT INTO balances (user_id, asset, chain, amount, updated_at) VALUES (?, ?, ?, ?, ?)`)
    .run(userId, "USDC", "base", "1000.000000", now());
}

test("GET /v1/quotes/:id returns quote", async () => {
  resetDb();
  seedUser("user_q_1");
  const app = Fastify();
  await registerQuoteRoutes(app);

  const quote = createQuote({
    idempotency_key: randomUUID(),
    user_id: "user_q_1",
    payee: { type: "vpa", identifier: "x@y" },
    amount_inr: 100,
    channel: "qr",
    asset_preference: "auto_cheapest",
  });

  const res = await app.inject({ method: "GET", url: `/v1/quotes/${quote.id}` });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.quote_id, quote.id);
  assert.equal(body.amount_inr, 100);
  assert.equal(body.expired, false);
});

test("GET /v1/quotes/:id 404 on unknown", async () => {
  resetDb();
  const app = Fastify();
  await registerQuoteRoutes(app);
  const res = await app.inject({ method: "GET", url: "/v1/quotes/q_nope" });
  assert.equal(res.statusCode, 404);
});

test("GET /v1/quotes/:id flags expired", async () => {
  resetDb();
  seedUser("user_q_2");
  const app = Fastify();
  await registerQuoteRoutes(app);

  const quote = createQuote({
    idempotency_key: randomUUID(),
    user_id: "user_q_2",
    payee: { type: "vpa", identifier: "x@y" },
    amount_inr: 50,
    channel: "qr",
    asset_preference: "auto_cheapest",
  });
  db().prepare(`UPDATE quotes SET expires_at = ? WHERE id = ?`).run(now() - 1000, quote.id);

  const res = await app.inject({ method: "GET", url: `/v1/quotes/${quote.id}` });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().expired, true);
});

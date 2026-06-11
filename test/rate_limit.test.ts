import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

process.env.DATABASE_URL = `./data/test-rl-${process.pid}.db`;

const { db, now } = await import("../src/db/index.js");
const { _resetRateLimits } = await import("../src/services/rate_limit.js");
const { registerQuoteRoutes } = await import("../src/routes/quote.js");
const Fastify = (await import("fastify")).default;

function reset() {
  _resetRateLimits();
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
  db().prepare(`INSERT INTO users (id, created_at, kyc_status) VALUES (?, ?, ?)`).run(id, now(), "approved");
  db().prepare(`INSERT INTO balances (user_id, asset, chain, amount, updated_at) VALUES (?, ?, ?, ?, ?)`)
    .run(id, "INR_CREDIT", "internal", "1000000", now());
}

test("/v1/quote returns 429 after 10 in a minute", async () => {
  reset();
  seed("u_rl");
  const app = Fastify();
  await registerQuoteRoutes(app);

  let last = 0;
  for (let i = 0; i < 11; i++) {
    const res = await app.inject({
      method: "POST",
      url: "/v1/quote",
      payload: {
        idempotency_key: randomUUID(),
        user_id: "u_rl",
        payee: { type: "vpa", identifier: "x@y" },
        amount_inr: 100,
        channel: "qr",
        asset_preference: "auto_cheapest",
      },
    });
    last = res.statusCode;
  }
  assert.equal(last, 429);
});

test("/v1/quote allows fresh user even when other rate-limited", async () => {
  reset();
  seed("u_a");
  seed("u_b");
  const app = Fastify();
  await registerQuoteRoutes(app);
  for (let i = 0; i < 11; i++) {
    await app.inject({
      method: "POST",
      url: "/v1/quote",
      payload: {
        idempotency_key: randomUUID(),
        user_id: "u_a",
        payee: { type: "vpa", identifier: "x@y" },
        amount_inr: 100,
        channel: "qr",
        asset_preference: "auto_cheapest",
      },
    });
  }
  const res = await app.inject({
    method: "POST",
    url: "/v1/quote",
    payload: {
      idempotency_key: randomUUID(),
      user_id: "u_b",
      payee: { type: "vpa", identifier: "x@y" },
      amount_inr: 100,
      channel: "qr",
      asset_preference: "auto_cheapest",
    },
  });
  assert.equal(res.statusCode, 200);
});

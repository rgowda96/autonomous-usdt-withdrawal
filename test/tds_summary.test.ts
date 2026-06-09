import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

process.env.DATABASE_URL = `./data/test-tds-${process.pid}.db`;

const { db, now } = await import("../src/db/index.js");
const { createQuote } = await import("../src/services/quote.js");
const { settle } = await import("../src/services/settle.js");
const { registerWalletRoutes } = await import("../src/routes/wallet.js");
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
  db().prepare(`INSERT INTO users (id, created_at, kyc_status) VALUES (?, ?, ?)`).run(id, now(), "approved");
  db().prepare(`INSERT INTO balances (user_id, asset, chain, amount, updated_at) VALUES (?, ?, ?, ?, ?)`)
    .run(id, "USDC", "base", "1000", now());
}

test("TDS summary aggregates by quarter", async () => {
  reset();
  seed("u_tds");
  const app = Fastify();
  await registerWalletRoutes(app);

  // 3 USDC settlements at 100, 200, 300 INR → TDS 1, 2, 3 (1% each)
  for (const amt of [100, 200, 300]) {
    const q = createQuote({
      idempotency_key: randomUUID(),
      user_id: "u_tds",
      payee: { type: "vpa", identifier: "x@y" },
      amount_inr: amt,
      channel: "qr",
      asset_preference: { asset: "USDC", chain: "base" },
    });
    await settle({ idempotency_key: randomUUID(), quote_id: q.id, auth_proof: "stub-passkey-xxxx" });
  }

  const res = await app.inject({ method: "GET", url: "/v1/users/u_tds/tds/summary" });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.user_id, "u_tds");
  assert.equal(body.tx_count, 3);
  assert.equal(body.total_inr, 6); // 1 + 2 + 3
  assert.ok(Array.isArray(body.by_quarter));
  assert.ok(body.by_quarter.length >= 1);
});

test("TDS summary filters by fy", async () => {
  reset();
  seed("u_tds2");
  const app = Fastify();
  await registerWalletRoutes(app);
  const res = await app.inject({ method: "GET", url: "/v1/users/u_tds2/tds/summary?fy=1999-00" });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().tx_count, 0);
});

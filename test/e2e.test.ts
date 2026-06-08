import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Force a fresh DB for the test run.
process.env.DATABASE_URL = "./data/test.db";

const { db, now } = await import("../src/db/index.js");
const { createQuote } = await import("../src/services/quote.js");
const { settle } = await import("../src/services/settle.js");

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
  const upsertBal = conn.prepare(
    `INSERT INTO balances (user_id, asset, chain, amount, updated_at) VALUES (?, ?, ?, ?, ?)`
  );
  upsertBal.run(userId, "USDC", "base", "1000.000000", now());
  upsertBal.run(userId, "USDT", "tron", "500.000000", now());
  upsertBal.run(userId, "INR_CREDIT", "internal", "2000.00", now());
}

test("end-to-end: quote → settle → tx PAYOUT_INITIATED", async () => {
  resetDb();
  seedUser("user_test_1");

  const idemQuote = randomUUID();
  const quote = createQuote({
    idempotency_key: idemQuote,
    user_id: "user_test_1",
    payee: { type: "vpa", identifier: "swiggy@hdfc", display_name: "Swiggy" },
    amount_inr: 500,
    channel: "qr",
    asset_preference: "auto_cheapest",
  });

  assert.ok(quote.id.startsWith("q_"));
  assert.equal(quote.amount_inr, 500);
  // INR_CREDIT should win because its fees are lowest
  assert.equal(quote.route_plan.source_asset, "INR_CREDIT");

  const result = await settle({
    idempotency_key: randomUUID(),
    quote_id: quote.id,
    auth_proof: "stub-passkey-assertion-aaaa",
  });

  assert.equal(result.status, "PAYOUT_INITIATED");
  assert.ok(result.transaction_id.startsWith("tx_"));
});

test("idempotency: same quote idem_key returns same quote", () => {
  resetDb();
  seedUser("user_test_2");
  const idem = randomUUID();
  const a = createQuote({
    idempotency_key: idem,
    user_id: "user_test_2",
    payee: { type: "vpa", identifier: "rohit@oksbi" },
    amount_inr: 100,
    channel: "p2p",
    asset_preference: "auto_cheapest",
  });
  const b = createQuote({
    idempotency_key: idem,
    user_id: "user_test_2",
    payee: { type: "vpa", identifier: "rohit@oksbi" },
    amount_inr: 100,
    channel: "p2p",
    asset_preference: "auto_cheapest",
  });
  assert.equal(a.id, b.id);
});

test("hodl_mode skips ETH and prefers USDC over INR_CREDIT when only stables allowed", () => {
  resetDb();
  // Drain INR_CREDIT for this user so USDC wins.
  const userId = "user_test_3";
  const conn = db();
  conn.prepare(`INSERT INTO users (id, created_at, kyc_status) VALUES (?, ?, ?)`)
    .run(userId, now(), "approved");
  conn.prepare(`INSERT INTO balances (user_id, asset, chain, amount, updated_at) VALUES (?, ?, ?, ?, ?)`)
    .run(userId, "USDC", "base", "1000.000000", now());
  conn.prepare(`INSERT INTO balances (user_id, asset, chain, amount, updated_at) VALUES (?, ?, ?, ?, ?)`)
    .run(userId, "ETH", "base", "1.000000", now());

  const q = createQuote({
    idempotency_key: randomUUID(),
    user_id: userId,
    payee: { type: "vpa", identifier: "x@y" },
    amount_inr: 500,
    channel: "qr",
    asset_preference: "hodl_mode",
  });
  assert.equal(q.route_plan.source_asset, "USDC");
});

test("expired quote rejects settle", async () => {
  resetDb();
  seedUser("user_test_4");
  process.env.QUOTE_TTL_SECONDS = "0"; // not picked up; we mutate directly instead
  const q = createQuote({
    idempotency_key: randomUUID(),
    user_id: "user_test_4",
    payee: { type: "vpa", identifier: "x@y" },
    amount_inr: 50,
    channel: "qr",
    asset_preference: "auto_cheapest",
  });
  db().prepare(`UPDATE quotes SET expires_at = ? WHERE id = ?`).run(now() - 1000, q.id);

  await assert.rejects(
    () => settle({ idempotency_key: randomUUID(), quote_id: q.id, auth_proof: "stub-passkey-assertion-aaaa" }),
    /QUOTE_EXPIRED/
  );
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

process.env.DATABASE_URL = `./data/test-idem-${process.pid}.db`;

const { db, now } = await import("../src/db/index.js");
const { createQuote } = await import("../src/services/quote.js");
const { _runIdempotencySweepOnce } = await import("../src/services/sweepers.js");

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
    .run(id, "INR_CREDIT", "internal", "10000", now());
}

test("sweeper expires quotes older than 24h", () => {
  reset();
  seed("u_x");
  const idem = randomUUID();
  const q = createQuote({
    idempotency_key: idem,
    user_id: "u_x",
    payee: { type: "vpa", identifier: "x@y" },
    amount_inr: 100,
    channel: "qr",
    asset_preference: "auto_cheapest",
  });

  // Backdate the quote 48 hours
  db().prepare(`UPDATE quotes SET created_at = ? WHERE id = ?`).run(Date.now() - 48 * 60 * 60 * 1000, q.id);

  _runIdempotencySweepOnce();

  const after = db().prepare(`SELECT idempotency_key FROM quotes WHERE id = ?`).get(q.id) as { idempotency_key: string };
  assert.ok(after.idempotency_key.startsWith("expired:"));

  // Same idem key can now be used by a new quote (collision resolved)
  const q2 = createQuote({
    idempotency_key: idem,
    user_id: "u_x",
    payee: { type: "vpa", identifier: "x@y" },
    amount_inr: 200,
    channel: "qr",
    asset_preference: "auto_cheapest",
  });
  assert.notEqual(q.id, q2.id);
});

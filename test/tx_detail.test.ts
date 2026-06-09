import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

process.env.DATABASE_URL = `./data/test-txdetail-${process.pid}.db`;

const { db, now } = await import("../src/db/index.js");
const { createQuote } = await import("../src/services/quote.js");
const { settle } = await import("../src/services/settle.js");
const { registerWalletRoutes } = await import("../src/routes/wallet.js");
const Fastify = (await import("fastify")).default;

function resetDb() {
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
function seedUser(id: string) {
  db().prepare(`INSERT INTO users (id, created_at, kyc_status) VALUES (?, ?, ?)`).run(id, now(), "approved");
  db().prepare(`INSERT INTO balances (user_id, asset, chain, amount, updated_at) VALUES (?, ?, ?, ?, ?)`)
    .run(id, "INR_CREDIT", "internal", "2000.00", now());
}

test("GET /v1/transactions/:id returns tx with timeline", async () => {
  resetDb();
  seedUser("u1");
  const app = Fastify();
  await registerWalletRoutes(app);

  const q = createQuote({
    idempotency_key: randomUUID(),
    user_id: "u1",
    payee: { type: "vpa", identifier: "swiggy@hdfc", display_name: "Swiggy" },
    amount_inr: 500,
    channel: "qr",
    asset_preference: "auto_cheapest",
  });
  const r = await settle({ idempotency_key: randomUUID(), quote_id: q.id, auth_proof: "stub-passkey-xxxx" });

  const res = await app.inject({ method: "GET", url: `/v1/transactions/${r.transaction_id}` });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.id, r.transaction_id);
  assert.equal(body.amount_inr, 500);
  assert.equal(body.payee.identifier, "swiggy@hdfc");
  assert.equal(body.payee.display_name, "Swiggy");
  assert.ok(Array.isArray(body.timeline));
  assert.ok(body.timeline.length >= 2); // PENDING, USDC_RECEIVED, PAYOUT_INITIATED
  assert.equal(body.timeline[0].to, "PENDING");
});

test("GET /v1/transactions/:id 404 on unknown", async () => {
  resetDb();
  const app = Fastify();
  await registerWalletRoutes(app);
  const res = await app.inject({ method: "GET", url: "/v1/transactions/tx_nope" });
  assert.equal(res.statusCode, 404);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

process.env.DATABASE_URL = `./data/test-cb-${process.pid}.db`;

const { db, now } = await import("../src/db/index.js");
const { createQuote } = await import("../src/services/quote.js");

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
function seed(id: string, asset = "USDC", chain = "base", amount = "1000") {
  db().prepare(`INSERT OR IGNORE INTO users (id, created_at, kyc_status) VALUES (?, ?, ?)`).run(id, now(), "approved");
  db().prepare(`INSERT INTO balances (user_id, asset, chain, amount, updated_at) VALUES (?, ?, ?, ?, ?)`)
    .run(id, asset, chain, amount, now());
}

test("cost_breakdown components sum to total_fee_bps for USDC", () => {
  reset();
  seed("u_cb1");
  const q = createQuote({
    idempotency_key: randomUUID(),
    user_id: "u_cb1",
    payee: { type: "vpa", identifier: "x@y" },
    amount_inr: 1000,
    channel: "qr",
    asset_preference: "auto_cheapest",
  });
  const sumBps = q.route_plan.cost_breakdown.reduce((s, c) => s + c.bps, 0);
  assert.equal(sumBps, q.route_plan.total_fee_bps);
});

test("breakdown includes Off-ramp for USDC, UPI rail for INR_CREDIT", () => {
  reset();
  seed("u_cb2", "USDC", "base", "1000");
  const q1 = createQuote({
    idempotency_key: randomUUID(),
    user_id: "u_cb2",
    payee: { type: "vpa", identifier: "x@y" },
    amount_inr: 100,
    channel: "qr",
    asset_preference: { asset: "USDC", chain: "base" },
  });
  assert.ok(q1.route_plan.cost_breakdown.some((c) => c.component.includes("Off-ramp")));

  reset();
  seed("u_cb3", "INR_CREDIT", "internal", "10000");
  const q2 = createQuote({
    idempotency_key: randomUUID(),
    user_id: "u_cb3",
    payee: { type: "vpa", identifier: "x@y" },
    amount_inr: 100,
    channel: "qr",
    asset_preference: "auto_cheapest",
  });
  assert.ok(q2.route_plan.cost_breakdown.some((c) => c.component === "UPI rail"));
  assert.ok(!q2.route_plan.cost_breakdown.some((c) => c.component.includes("Off-ramp")));
});
